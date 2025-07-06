// src/controller.ts
import * as vscode from 'vscode';
import { MarkdownFileCoverage } from '../coverage';
import { Config, ExeConfig, BinConfig, CMakeConfig, ConfigType } from '../config';
import { runner } from '../runner';
import { getTestRunHandler, getTestRunHandlerWithExitCode, loadDetailedCoverageHandler, getTestListHandler, getCTestDiscoveryHandler, getCTestDataForTest } from './resultHandler';
import { CTestParser } from '../tclist_parser/ctestParser';


// todo
const controllerId2ConfigTypeMap = new Map<string, ConfigType>([
	['exe_test', ConfigType.ExeConfig],
	['cdoctest', ConfigType.Config],
	['bin_test', ConfigType.BinConfig],
	['cmake_test', ConfigType.CMakeConfig]
]);
// controllerIdToControllerMap is a map of controllerId to TestController
const configType2ControllereMap = new Map<ConfigType, string>([
	[ConfigType.ExeConfig, 'exe_test'],
	[ConfigType.Config, 'cdoctest'],
	[ConfigType.BinConfig, 'bin_test'],
	[ConfigType.CMakeConfig, 'cmake_test']
]);
const exeCtrl = vscode.tests.createTestController('exe_test', 'Cpp Executable Test');
const cdocCtrl = vscode.tests.createTestController('cdoctest', 'codctest Test');
const binCtrl = vscode.tests.createTestController('bin_test', 'Binary Test');
const cmakeCtrl = vscode.tests.createTestController('cmake_test', 'CMake Test');
const controllerId2ControllerMap = new Map<string, vscode.TestController>([
	['exe_test', exeCtrl],
	['cdoctest', cdocCtrl],
	['bin_test', binCtrl],
	['cmake_test', cmakeCtrl]
]);
const configList: (Config | ExeConfig | BinConfig | CMakeConfig)[] = [];
let refreshCancellationSource: vscode.CancellationTokenSource | undefined;
let runCancellationSource: vscode.CancellationTokenSource | undefined;

export function getConfigByController(ctrl: vscode.TestController): Config | ExeConfig | BinConfig | CMakeConfig | undefined {
	return configList[controllerId2ConfigTypeMap.get(ctrl.id) as ConfigType];
}

async function _startTestRun(curCtrl: vscode.TestController, request: vscode.TestRunRequest, token: vscode.CancellationToken, isDebug: boolean) {
	if (runCancellationSource === undefined) {
		return;
	}

	// Create a new test run
	const run = curCtrl.createTestRun(request, 'runToken');

	// Determine which tests to run. If request.include is not provided,
	// you may want to run all tests. In this example, we'll assume request.include exists.
	const testsToRun: vscode.TestItem[] = request.include ? Array.from(request.include) : [];
	let testCasesToRun: vscode.TestItem[] = [];

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
		const config = configList[controllerId2ConfigTypeMap.get(curCtrl.id) as ConfigType];
		if (runCancellationSource?.token.isCancellationRequested) {
			run.skipped(test);
			return;
		}
		if (config === undefined) {
			return;
		}
		run.started(test);
		try {
			if (test.parent === undefined) {
				run.failed(test, new Error('Test parent is undefined'), 1000);
				return;
			}
			
			// Check if we have CTest data for this test
			const ctestData = getCTestDataForTest(test.id);
			let executableArgs: string[] | undefined;
			let workingDir: string;
			let resultFile: string = config.exe_resultFile;
			let useExitCodeHandler = false;
			
			if (ctestData && config.useCTestDiscovery && config.useCmakeTarget) {
				// Use CTest data for execution
				executableArgs = [ctestData.executable, ...ctestData.args];
				workingDir = ctestData.workingDirectory || config.buildDirectory;
				// When using CTest, we can rely on exit codes if configured
				useExitCodeHandler = config.ctestUseExitCode;
				
				// Adjust result file based on test framework if needed
				if (ctestData.testFramework) {
					// Different frameworks might have different result file patterns
					// For now, use the same result file, but this can be customized per framework
					console.log(`Running ${ctestData.testFramework} test: ${test.id}`);
				}
			} else {
				// Fall back to traditional execution
				const argDict = {
					'test_full_name': test.id,
					'test_suite_name': test.parent.id,
					'test_case_name': test.label
				};
				executableArgs = config.get_exe_testrun_executable_args(argDict);
				workingDir = config.buildDirectory;
			}

			// Wrap the runner call in a Promise so that we wait for the result.
			await new Promise<void>((resolve, reject) => {
				const handler = useExitCodeHandler 
					? getTestRunHandlerWithExitCode(test, config, run, resolve)
					: getTestRunHandler(test, config, run, resolve);
				
				runner(
					executableArgs,
					workingDir,
					config.exe_testRunUseFile,
					resultFile,
					config,
					refreshCancellationSource,
					handler,
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
function getStartTestRun(curCtrl: vscode.TestController) {
	return (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
		return _startTestRun(curCtrl, request, token, false);
	};
}
function getStartDebugRun(curCtrl: vscode.TestController) {
	return (request: vscode.TestRunRequest, token: vscode.CancellationToken) => {
		return _startTestRun(curCtrl, request, token, true);
	};
}

export function _setupController(
	curCtrl: vscode.TestController,
	fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	context: vscode.ExtensionContext,
	config: Config | ExeConfig | BinConfig | CMakeConfig
) {
	configList[controllerId2ConfigTypeMap.get(curCtrl.id) as ConfigType] = config;

	context.subscriptions.push(curCtrl);

	refreshCancellationSource = new vscode.CancellationTokenSource();
	runCancellationSource = new vscode.CancellationTokenSource();

	// Create run profiles
	curCtrl.createRunProfile(
		'Run Tests',
		vscode.TestRunProfileKind.Run,
		getStartTestRun(curCtrl),
		true,
		undefined,
		true
	);

	// Create debug profiles
	if (config.type === ConfigType.ExeConfig) {
		curCtrl.createRunProfile(
			'Debug Tests',
			vscode.TestRunProfileKind.Debug,
			getStartDebugRun(curCtrl),
			true,
			undefined,
			true
		);
	}
	if (false) {
		const coverageProfile = curCtrl.createRunProfile(
			'Run with Coverage',
			vscode.TestRunProfileKind.Coverage,
			getStartTestRun(curCtrl),
			true,
			undefined,
			true
		);
		coverageProfile.loadDetailedCoverage = loadDetailedCoverageHandler;
	}
	configList.push(config);
	curCtrl.refreshHandler = async () => {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}
		if (refreshCancellationSource === undefined) {
			return;
		}
		const ctrl = controllerId2ControllerMap.get(configType2ControllereMap.get(config.type) as string) as vscode.TestController;
		
		// Use CTest discovery if enabled and using CMake
		if (config.type === ConfigType.CMakeConfig) {
			try {
				await getCTestDiscoveryHandler(ctrl, config);
				
				// Set up file watcher for CTest files
				const buildType = config.cmakeBuildType || "";
				const parser = new CTestParser(config);
				const watcher = await parser.watchForChanges(async () => {
					await getCTestDiscoveryHandler(ctrl, config);
				});
				context.subscriptions.push(watcher);
			} catch (error) {
				console.error('CTest discovery failed, falling back to executable:', error);
				// Fall back to running executable
				runner(config.testrun_list_args, config.buildDirectory, config.listTestUseFile, config.resultFile, config, refreshCancellationSource,
					getTestListHandler(ctrl));
			}
		} else {
			// Use traditional executable-based discovery
			runner(config.testrun_list_args, config.buildDirectory, config.listTestUseFile, config.resultFile, config, refreshCancellationSource,
				getTestListHandler(ctrl));
		}
	};
}

export function setupController(
	fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	context: vscode.ExtensionContext,
	config: Config | ExeConfig | BinConfig | CMakeConfig
) {
	const cntr = controllerId2ControllerMap.get(configType2ControllereMap.get(config.type) as string);
	if (cntr) {
		return _setupController(cntr, fileChangedEmitter, context, config);
	} else {
		throw new Error('TestController not found for the given config type');
	}
}

