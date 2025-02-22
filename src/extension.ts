// src/extension.ts
import * as vscode from 'vscode';
import { getContentFromFilesystem, testData } from './testTree';
import { Config } from './config';
import { getOrCreateFile } from './fileHelper';
import { runHandler, startTestRun } from './testRunner';
import { startWatchingWorkspace } from './watchers';
import { MarkdownFileCoverage } from './coverage';
import { ctrl, setupController } from './controller';
import { CMakeToolsApi, Version, getCMakeToolsApi, UIElement } from 'vscode-cmake-tools';

let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	const watchingTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();

	async function _ativeWorkspace(config: Config) {
		// Listen for file changes and trigger test runs.
		fileChangedEmitter.event(uri => {
			if (watchingTests.has('ALL')) {
				startTestRun(new vscode.TestRunRequest(undefined, undefined, watchingTests.get('ALL'), true), ctrl);
				return;
			}

			const include: vscode.TestItem[] = [];
			let profile: vscode.TestRunProfile | undefined;
			for (const [item, thisProfile] of watchingTests) {
				if (item !== 'ALL' && item.uri?.toString() === uri.toString()) {
					include.push(item);
					profile = thisProfile;
				}
			}

			if (include.length) {
				startTestRun(new vscode.TestRunRequest(include, undefined, profile, true), ctrl);
			}
		});

		// Define the run test request function.
		const runTestRequest = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
			if (!request.continuous) {
				return startTestRun(request, ctrl);
			}

			if (request.include === undefined) {
				watchingTests.set('ALL', request.profile);
				cancellation.onCancellationRequested(() => watchingTests.delete('ALL'));
			} else {
				request.include.forEach(item => watchingTests.set(item, request.profile));
				cancellation.onCancellationRequested(() =>
					request.include!.forEach(item => watchingTests.delete(item))
				);
			}
		};

		// Call setupController to initialize the controller run profiles and handlers.
		setupController(runTestRequest, fileChangedEmitter, context);

		// Update tests when a document is opened or changed.
		function updateNodeForDocument(e: vscode.TextDocument) {
			if (e.uri.scheme !== 'file' || (!e.uri.path.endsWith('.c') && !e.uri.path.endsWith('.cpp') && !e.uri.path.endsWith('.h'))) {
				return;
			}
			const { file, data } = getOrCreateFile(ctrl, e.uri);
			data.updateFromContents(ctrl, e.getText(), file);
		}

		for (const document of vscode.workspace.textDocuments) {
			updateNodeForDocument(document);
		}

		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
			vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document))
		);
	}

	async function ativeWorkspace() {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}
		if (lastWorkspace === vscode.workspace.workspaceFolders[0]) {
			return;
		}
		const config = new Config();
		if (!config.useCmakeTarget) {
			_ativeWorkspace(config);
		} else {
			const cmakeApi: CMakeToolsApi | undefined = await getCMakeToolsApi(Version.v2, /*exactMatch*/ false);
			if (!cmakeApi) {
				vscode.window.showErrorMessage('CMake Tools API is unavailable. Please install CMake Tools.');
				return;
			}
			const configDoneDisposable = cmakeApi.onActiveProjectChanged((projectUri) => {
				if (projectUri) {
				  vscode.window.showInformationMessage('CMake configuration is complete!');
				  _ativeWorkspace(config);
				}
			  });
			context.subscriptions.push(configDoneDisposable);
		}
	}
	vscode.workspace.onDidChangeWorkspaceFolders(ativeWorkspace);
	if (vscode.workspace.workspaceFolders) {
        ativeWorkspace();
    }
	
}
