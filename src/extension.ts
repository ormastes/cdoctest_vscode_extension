// src/extension.ts
import * as vscode from 'vscode';
import { Config, ExeConfig, BinConfig, CMakeConfig } from './config';
import { MarkdownFileCoverage } from './coverage';
import { setupController } from './controller/controller';
import { initRunner } from './runner';
import { checkCDocTestVersion, getToolchainDir,  addNewToolchain, checkToolchainInstalled} from './pyAdapter';


let exeConfig: Config | undefined;
let cdocConfig: Config | undefined;
let binConfig: Config | undefined;
let cmakeConfig: Config | undefined;
let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	initRunner(context);

	async function _ativeWorkspace(config: Config | ExeConfig | BinConfig | CMakeConfig) {

		// Call setupController to initialize the controller run profiles and handlers.
		setupController(fileChangedEmitter, context, config);

		// Listen for file changes and trigger test runs.
		//listenFileChangeForTclist(fileChangedEmitter, watchingTests, context);
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
		if (exeConfig) {
			exeConfig.dispose();
		}
		if (cdocConfig) {
			cdocConfig.dispose();
		}
		if (binConfig) {
			binConfig.dispose();
		}
		if (cmakeConfig) {
			cmakeConfig.dispose();
		}
		// Get configuration settings
		const config = vscode.workspace.getConfiguration('cdoctest');
		
		// Only create configurations that are enabled
		if (config.get<boolean>('enableExeConfig', true)) {
			exeConfig = await new ExeConfig(context, newWorkspace, _ativeWorkspace);
		}
		if (config.get<boolean>('enableCdoctestConfig', true)) {
			cdocConfig = await new Config(context, newWorkspace, _ativeWorkspace);
		}
		if (config.get<boolean>('enableBinConfig', true)) {
			binConfig = await new BinConfig(context, newWorkspace, _ativeWorkspace);
		}
		if (config.get<boolean>('enableCmakeConfig', true)) {
			cmakeConfig = await new CMakeConfig(context, newWorkspace, _ativeWorkspace);
		}
		// Only check cdoctest version if exeConfig is enabled
		if (exeConfig) {
			checkCDocTestVersion(exeConfig).then(async(installed: any) => {
				if (!installed) {
					console.error('Error checking cdoctest version not met minimum required version:', exeConfig?.cdoctest_min_version);
					console.error('Please install the cdoctest on python by "python -m pip install --upgrade cdoctest".');
				} 
				if (!await checkToolchainInstalled(exeConfig!)) {
					console.error('Error checking cdoctest toolchain. Toolchain on cdoctest is not set or installed.');
					console.error('Please install the toolchain on cdoctest by "python -m clang_repl_kernel --install-default-toolchain".');
				}

				getToolchainDir(exeConfig!).then((toolChainDir: any) => {
					if (!toolChainDir) {
						console.error('Error getting toolchain of clang_repl_kernel directory. Toolchain on clang_repl_kernel is not set or installed.');
					}
					console.log('Clang REPL kernel toolchain directory:', toolChainDir);
					addNewToolchain(toolChainDir);
				}).catch((error: any) => {
					console.error('Error getting toolchain or clang_repl_kernel directory:', error);
				});
			}).catch((error: any) => {
				console.error('Error checking cdoctest version:', error);
			});
		}
	}
	vscode.workspace.onDidChangeWorkspaceFolders(ativeWorkspace);
	if (vscode.workspace.workspaceFolders) {
        ativeWorkspace();
    }
	
}



