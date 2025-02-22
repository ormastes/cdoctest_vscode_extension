// src/testRunner.ts
import * as vscode from 'vscode';
import { getContentFromFilesystem, testData, TestCase, TestFile } from './testTree';
import { gatherTestItems } from './fileHelper';
import { MarkdownFileCoverage } from './coverage';

export function runHandler(
	request: vscode.TestRunRequest,
	cancellation: vscode.CancellationToken,
	ctrl: vscode.TestController,
	_fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	_watchingTests: Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>
) {
	if (!request.continuous) {
		return startTestRun(request, ctrl);
	}

	if (request.include === undefined) {
		_watchingTests.set('ALL', request.profile);
		cancellation.onCancellationRequested(() => _watchingTests.delete('ALL'));
	} else {
		request.include.forEach(item => _watchingTests.set(item, request.profile));
		cancellation.onCancellationRequested(() => request.include!.forEach(item => _watchingTests.delete(item)));
	}
}

export function startTestRun(request: vscode.TestRunRequest, ctrl: vscode.TestController) {
	const queue: { test: vscode.TestItem; data: TestCase }[] = [];
	const run = ctrl.createTestRun(request);
	// Map from file uri to statement coverage info.
	const coveredLines = new Map<string, (vscode.StatementCoverage | undefined)[]>();

	async function discoverTests(tests: Iterable<vscode.TestItem>) {
		for (const test of tests) {
			if (request.exclude?.includes(test)) {
				continue;
			}
			const data = testData.get(test);
			if (data instanceof TestCase) {
				run.enqueued(test);
				queue.push({ test, data });
			} else {
				if (data instanceof TestFile && !data.didResolve) {
					await data.updateFromDisk(ctrl, test);
				}
				await discoverTests(gatherTestItems(test.children));
			}

			if (test.uri && !coveredLines.has(test.uri.toString()) && request.profile?.kind === vscode.TestRunProfileKind.Coverage) {
				try {
					const lines = (await getContentFromFilesystem(test.uri)).split('\n');
					coveredLines.set(
						test.uri.toString(),
						lines.map((lineText, lineNo) =>
							lineText.trim().length ? new vscode.StatementCoverage(0, new vscode.Position(lineNo, 0)) : undefined
						)
					);
				} catch {
					// Ignored if file cannot be read.
				}
			}
		}
	}

	async function runTestQueue() {
		for (const { test, data } of queue) {
			run.appendOutput(`Running ${test.id}\r\n`);
			if (run.token.isCancellationRequested) {
				run.skipped(test);
			} else {
				run.started(test);
				await data.run(test, run);
			}
			const lineNo = test.range!.start.line;
			const fileCoverage = coveredLines.get(test.uri!.toString());
			const lineInfo = fileCoverage?.[lineNo];
			if (lineInfo) {
				(lineInfo.executed as number)++;
			}
			run.appendOutput(`Completed ${test.id}\r\n`);
		}

		for (const [uri, statements] of coveredLines) {
			run.addCoverage(new MarkdownFileCoverage(uri, statements));
		}

		run.end();
	}

	discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(runTestQueue);
}
