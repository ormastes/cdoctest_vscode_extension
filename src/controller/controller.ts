// src/controller.ts
import * as vscode from 'vscode';
import { MarkdownFileCoverage } from '../coverage';
import { Config, ExeConfig, BinConfig, ConfigType } from '../config';
import { runner } from '../runner';
import { getTestRunHandler, loadDetailedCoverageHandler, getTestListHandler } from './resultHandler';


// todo
const controllerId2ConfigTypeMap = new Map<string, ConfigType>([
	['exe_test', ConfigType.ExeConfig],
	['cdoctest', ConfigType.Config],
	['bin_test', ConfigType.BinConfig]
]);
// controllerIdToControllerMap is a map of controllerId to TestController
const configType2ControllereMap = new Map<ConfigType, string>([
	[ConfigType.ExeConfig, 'exe_test'],
	[ConfigType.Config, 'cdoctest'],
	[ConfigType.BinConfig, 'bin_test']
]);
const exeCtrl = vscode.tests.createTestController('exe_test', 'Cpp Executable Test');
const cdocCtrl = vscode.tests.createTestController('cdoctest', 'codctest Test');
const binCtrl = vscode.tests.createTestController('bin_test', 'Binary Test');
const controllerId2ControllerMap = new Map<string, vscode.TestController>([
	['exe_test', exeCtrl],
	['cdoctest', cdocCtrl],
	['bin_test', binCtrl]
]);
const configList: (Config | ExeConfig | BinConfig)[] = [];
let refreshCancellationSource: vscode.CancellationTokenSource | undefined;
let runCancellationSource: vscode.CancellationTokenSource | undefined;

export function getConfigByController(ctrl: vscode.TestController): Config | ExeConfig | BinConfig | undefined {
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
					getTestRunHandler(test, config, run, resolve),
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
	config: Config | ExeConfig | BinConfig
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
			getStartTestRun(curCtrl),
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
		runner(config.testrun_list_args, config.buildDirectory, config.listTestUseFile, config.resultFile, config, refreshCancellationSource,
			getTestListHandler(ctrl));
	};
}

export function setupController(
	fileChangedEmitter: vscode.EventEmitter<vscode.Uri>,
	context: vscode.ExtensionContext,
	config: Config | ExeConfig | BinConfig
) {
	const cntr = controllerId2ControllerMap.get(configType2ControllereMap.get(config.type) as string);
	if (cntr) {
		return _setupController(cntr, fileChangedEmitter, context, config);
	} else {
		throw new Error('TestController not found for the given config type');
	}
}

