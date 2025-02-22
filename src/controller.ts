// src/controller.ts
import * as vscode from 'vscode';
import { getWorkspaceTestPatterns, findInitialFiles } from './fileHelper';
import { startWatchingWorkspace } from './watchers';
import { MarkdownFileCoverage } from './coverage';
import { testData } from './testTree';

export const ctrl = vscode.tests.createTestController('mathTestController', 'Markdown Math');

export function setupController(
	runTestRequest: (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => void,
	fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	context: vscode.ExtensionContext
) {
	context.subscriptions.push(ctrl);
	
	// Create run profiles
	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runTestRequest, true, undefined, true);

	const coverageProfile = ctrl.createRunProfile(
		'Run with Coverage',
		vscode.TestRunProfileKind.Coverage,
		runTestRequest,
		true,
		undefined,
		true
	);
	coverageProfile.loadDetailedCoverage = async (_testRun, coverage) => {
		if (coverage instanceof MarkdownFileCoverage) {
			return coverage.coveredLines.filter((l): l is vscode.StatementCoverage => !!l);
		}
		return [];
	};

	// Set refresh handler to initialize tests from workspace files.
	ctrl.refreshHandler = async () => {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}
		await Promise.all(getWorkspaceTestPatterns().map(({ pattern }) => findInitialFiles(ctrl, pattern)));
	};

	// Set resolve handler to update tests when needed.
	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter));
			return;
		}
		const data = testData.get(item);
		// Dynamically import TestFile to avoid circular dependency issues.
		const { TestFile } = await import('./testTree.js');
		if (data instanceof TestFile) {
			await data.updateFromDisk(ctrl, item);
		}
	};
}
