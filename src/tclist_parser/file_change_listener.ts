import * as vscode from 'vscode';
import { getOrCreateFile } from './fileHelper';
import { testData } from './testTree';
import { get } from 'http';

export function getResolveTcListHandler(curCtrl: vscode.TestController) {
	return async (item: vscode.TestItem | undefined): Promise<void> => {
		if (item) {
			const data = testData.get(item);
			// Dynamically import TestFile to avoid circular dependency issues.
			const { TestFile } = await import('./testTree.js');
			if (data instanceof TestFile) {
				await data.updateFromDisk(curCtrl, item);
			}
		}
	};
}

function updateFileNodesOnDocumentChange(curCtrl: vscode.TestController, context: vscode.ExtensionContext) {
	function updateNodeForDocument(e: vscode.TextDocument) {
		if (e.uri.scheme !== 'file' || (!e.uri.path.endsWith('.c') && !e.uri.path.endsWith('.cpp') && !e.uri.path.endsWith('.h'))) {
			return;
		}
		const { file, data } = getOrCreateFile(curCtrl, e.uri);
		data.updateFromContents(curCtrl, e.getText(), file);
	}

	for (const document of vscode.workspace.textDocuments) {
		updateNodeForDocument(document);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document))
	);
}

export function getListenFileChangeForTclist(curCtrl: vscode.TestController) {
	return (fileChangedEmitter: vscode.EventEmitter<vscode.Uri>, watchingTests: Map<vscode.TestItem | "ALL", vscode.TestRunProfile | undefined>, context: vscode.ExtensionContext) => {
		fileChangedEmitter.event((uri: vscode.Uri) => {
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

		// Update tests when a document is opened or changed.
		updateFileNodesOnDocumentChange(curCtrl, context);
	};
}