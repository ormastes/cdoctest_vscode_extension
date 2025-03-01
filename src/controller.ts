// src/controller.ts
import * as vscode from 'vscode';
import { MarkdownFileCoverage } from './coverage';
import { Config } from './config';
import { runner } from './runner';
import { resolveTcListHandler } from './tclist_parser/file_change_listener';


export const ctrl = vscode.tests.createTestController('mathTestController', 'Markdown Math');
let _config: Config | undefined;
let refreshCancellationSource: vscode.CancellationTokenSource | undefined;
let runCancellationSource: vscode.CancellationTokenSource | undefined;

export async function _startTestRun(request: vscode.TestRunRequest, token: vscode.CancellationToken, isDebug: boolean) {
	if (runCancellationSource === undefined) {
		return;
	}

	// Create a new test run
	const run = ctrl.createTestRun(request, 'runToken');
  
	// Determine which tests to run. If request.include is not provided,
	// you may want to run all tests. In this example, we'll assume request.include exists.
	const testsToRun: vscode.TestItem[] = request.include ? Array.from(request.include) : [];
	let testCasesToRun : vscode.TestItem[] = [];

	for (const test of testsToRun) {
		if (test.children.size > 0) {
			test.children.forEach((value) => {
				testCasesToRun.push(value);
			});
		} else {
			testCasesToRun.push(test);
		}
	}

	// Mark all tests as enqueued
	testCasesToRun.forEach(test => run.enqueued(test));
  
	const runTest = async (test: vscode.TestItem): Promise<void> => {
		if (runCancellationSource?.token.isCancellationRequested) {
		  run.skipped(test);
		  return;
		}
		if (_config === undefined) {
		  return;
		}
		const config = _config;
		run.started(test);
		try {
		  if (test.parent === undefined) {
			run.failed(test, new Error('Test parent is undefined'), 1000);
			return;
		  }
		  const argDict = {
			'test_full_name': test.id,
			'test_suite_name': test.parent.id,
			'test_case_name': test.label
		  };
	  
		  // Wrap the runner call in a Promise so that we wait for the result.
		  await new Promise<void>((resolve, reject) => {
			runner(
			  config.get_exe_testrun_executable_args(argDict),
			  config.buildDirectory,
			  config.exe_testRunUseFile,
			  config.exe_resultFile,
			  config,
			  refreshCancellationSource,
			  (result: string) => {
				if (result.match(config.resultSuccessRgex)) {
				  run.passed(test, 1000);
				} else {
				  console.error(`Test failed: ${result}`);
				  run.failed(test, new Error(`Test failed: ${result}`), 1000);
				}
				resolve();
			  },
			  isDebug
			);
		  });
		} catch (err) {
		  console.error(`Error reading result file: ${err}`);
		  run.failed(test, err as Error, 1000);
		}
	  };
	  
	  // Then run tests sequentially:
	for (const test of testCasesToRun) {
		await runTest(test);
 	 }
	run.end();
}
async function startTestRun(request: vscode.TestRunRequest, token: vscode.CancellationToken) {
	return _startTestRun(request, token, false);
}

async function startDebugRun(request: vscode.TestRunRequest, token: vscode.CancellationToken) {
	return _startTestRun(request, token, true);
}


export function setupController(
	fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	context: vscode.ExtensionContext,
	config: Config
) {
	_config = config;
	context.subscriptions.push(ctrl);

	refreshCancellationSource = new vscode.CancellationTokenSource();
	runCancellationSource = new vscode.CancellationTokenSource();

	// Create run profiles
	ctrl.createRunProfile(
		'Run Tests', 
		vscode.TestRunProfileKind.Run, 
		startTestRun, 
		true, 
		undefined, 
		true
	);

	// Create debug profiles
	ctrl.createRunProfile(
		'Debug Tests', 
		vscode.TestRunProfileKind.Run, 
		startDebugRun, 
		true, 
		undefined, 
		true
	);

	const coverageProfile = ctrl.createRunProfile(
		'Run with Coverage',
		vscode.TestRunProfileKind.Coverage,
		startTestRun,
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
		if (refreshCancellationSource === undefined) {
			return;
		}
		config.update_exe_executable().then(() => {
			runner(config.testrun_list_args, config.buildDirectory, config.listTestUseFile, config.resultFile, config, refreshCancellationSource, (result: string) => {
				// Parse the result string and update the test tree.
				const lines = result.split('\n');
			});
		});

		
		
		const handleTestListLines = (line: string) => {
			// skip if line does not contain ','
			if (line.indexOf(',') === -1) {
				return;
			}
			const testCaseInfo = line.split(',');
			const fixtureTest = testCaseInfo[0];
			const _sourceFile = testCaseInfo[1];
			const _sourceLine = testCaseInfo[2];
            //const [fixture, test] = fixtureTest.split('::');
			// find last '::' and split
			// if not found fixture is empty '', test is fixtureTest
			const lastColon = fixtureTest.lastIndexOf('::');
			if (lastColon === -1) {
				var fixture = 'default';
				var test = fixtureTest;
			} else {
				var fixture = fixtureTest.slice(0, lastColon);
				var test = fixtureTest.slice(lastColon + 2);
			}
			fixture = fixture.trim();
			test = test.trim();
			var sourceFile = _sourceFile.trim();
			var sourceLine = _sourceLine.trim();

            
            //let fixtureTests = <TestSuiteInfo>testSuite.children.find(
            //    value => value.id == fixture
            //);
			let root_item = ctrl.items.get('root-suite');
			if (!root_item) {
				root_item = ctrl.createTestItem('root-suite', 'CPP Executable Test');
				root_item.canResolveChildren = true;
				ctrl.items.add(root_item);
			}

			let fixture_item = root_item?.children.get(fixture);
			if (!fixture_item) {
				let uri = vscode.Uri.file(sourceFile);
				fixture_item = ctrl.createTestItem(fixture, fixture, uri);
				fixture_item.canResolveChildren = true;
				root_item?.children.add(fixture_item);
			}

			let test_item = fixture_item?.children.get(fixtureTest);
			if (!test_item) {
				let uri = vscode.Uri.file(sourceFile);
				test_item = ctrl.createTestItem(fixtureTest, test, uri);
				test_item.range = new vscode.Range(parseInt(sourceLine) - 1, 0, parseInt(sourceLine) - 1, 0);
				fixture_item?.children.add(test_item);
			} else {
				test_item.range = new vscode.Range(parseInt(sourceLine) - 1, 0, parseInt(sourceLine) - 1, 0);
			}
		};


		runner(config.exe_testrun_list_args, config.buildDirectory, config.exe_listTestUseFile, config.exe_resultFile, config, refreshCancellationSource, (result: string) => {
			let root_item = ctrl.items.get('root-suite');
			if (!root_item) {
				root_item = ctrl.createTestItem('root-suite', 'CPP Executable Test');
				root_item.canResolveChildren = true;
				ctrl.items.add(root_item);
			}
			const childIds: string[] = [];
			root_item.children.forEach(item => {
				childIds.push(item.id);
			});

			// Then, delete each child by its ID
			childIds.forEach(id => {
				root_item.children.delete(id);
			});
			const lines = result.split('\n');
			lines.forEach(handleTestListLines);
		});

	};

	// dummy replace resolveTcListHandler 
	//ctrl.resolveHandler = resolveTcListHandler;
}

