// src/fileHelpers.ts
import * as vscode from 'vscode';
import { TestFile, testData } from './testTree';

export function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
	const key = uri.toString();
	const existing = controller.items.get(key);
	if (existing) {
		return { file: existing, data: testData.get(existing) as TestFile };
	}

	const file = controller.createTestItem(key, uri.path.split('/').pop()!, uri);
	controller.items.add(file);
	const data = new TestFile();
	testData.set(file, data);
	file.canResolveChildren = true;
	return { file, data };
}

export function gatherTestItems(collection: vscode.TestItemCollection): vscode.TestItem[] {
	const items: vscode.TestItem[] = [];
	collection.forEach(item => items.push(item));
	return items;
}

export function getWorkspaceTestPatterns() {
	if (!vscode.workspace.workspaceFolders) {
		return [];
	}
	return vscode.workspace.workspaceFolders.map(workspaceFolder => ({
		workspaceFolder,
		pattern: new vscode.RelativePattern(workspaceFolder, '**/*.md')
	}));
}

export async function findInitialFiles(controller: vscode.TestController, pattern: vscode.GlobPattern) {
	const files = await vscode.workspace.findFiles(pattern);
	for (const file of files) {
		getOrCreateFile(controller, file);
	}
}
