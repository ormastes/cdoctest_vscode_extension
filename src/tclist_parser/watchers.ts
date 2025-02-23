// src/watchers.ts
import * as vscode from 'vscode';
import { getOrCreateFile, findInitialFiles, getWorkspaceTestPatterns } from './fileHelper';

export function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri>) {
	return getWorkspaceTestPatterns().map(({ pattern }) => {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern);
		watcher.onDidCreate(uri => {
			getOrCreateFile(controller, uri);
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidChange(async uri => {
			const { file, data } = getOrCreateFile(controller, uri);
			if (data.didResolve) {
				await data.updateFromDisk(controller, file);
			}
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidDelete(uri => controller.items.delete(uri.toString()));
		findInitialFiles(controller, pattern);
		return watcher;
	});
}
