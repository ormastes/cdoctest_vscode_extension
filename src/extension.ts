// src/extension.ts
import * as vscode from 'vscode';
import { getContentFromFilesystem, testData } from './testTree';
import { Config } from './config';
import { getOrCreateFile } from './fileHelper';
import { startWatchingWorkspace } from './watchers';
import { MarkdownFileCoverage } from './coverage';
import { ctrl, setupController } from './controller';
import { CMakeToolsApi, Version, getCMakeToolsApi, UIElement } from 'vscode-cmake-tools';
import { config } from 'process';

let currentConfig: Config | undefined;
let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	const watchingTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();

	async function _ativeWorkspace(config: Config) {
		// Listen for file changes and trigger test runs.
		fileChangedEmitter.event(uri => {
			if (watchingTests.has('ALL')) {
				//startTestRun(new vscode.TestRunRequest(undefined, undefined, watchingTests.get('ALL'), true), ctrl);
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
				//startTestRun(new vscode.TestRunRequest(include, undefined, profile, true), ctrl);
			}
		});

		// Call setupController to initialize the controller run profiles and handlers.
		setupController(fileChangedEmitter, context, config);

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
		const newWorkspace = vscode.workspace.workspaceFolders[0];
		if (lastWorkspace === newWorkspace) {
			return;
		}
		lastWorkspace = newWorkspace;
		
		// Dispose previous instance if needed
		if (currentConfig) {
			currentConfig.dispose();
		}
		currentConfig = new Config(context, newWorkspace, _ativeWorkspace);
	}
	vscode.workspace.onDidChangeWorkspaceFolders(ativeWorkspace);
	if (vscode.workspace.workspaceFolders) {
        ativeWorkspace();
    }
	
}
