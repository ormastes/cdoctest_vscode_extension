// src/extension.ts
import * as vscode from 'vscode';
import { Config, ExeConfig, BinConfig } from './config';
import { MarkdownFileCoverage } from './coverage';
import { setupController } from './controller/controller';
import { initRunner } from './runner';
import { checkCDocTestVersion, getToolchainDir,  addNewToolchain, checkToolchainInstalled} from './pyAdapter';


let exeConfig: Config | undefined;
let cdocConfig: Config | undefined;
let binConfig: Config | undefined;
let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	initRunner(context);

	async function _ativeWorkspace(config: Config | ExeConfig | BinConfig) {

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
		exeConfig = await new ExeConfig(context, newWorkspace, _ativeWorkspace);
		cdocConfig = await new Config(context, newWorkspace, _ativeWorkspace);
		binConfig = await new BinConfig(context, newWorkspace, _ativeWorkspace);
		checkCDocTestVersion(exeConfig).then(async(installed: any) => {
			if (!installed) {
				console.error('Error checking cdoctest version not met minimum required version:', exeConfig?.cdoctest_min_version);
				console.error('Please install the cdoctest on python by "python -m pip install --upgrade cdoctest".');
				return;
			} 
			if (!await checkToolchainInstalled(exeConfig!)) {
				console.error('Error checking cdoctest toolchain. Toolchain on cdoctest is not set or installed.');
				console.error('Please install the toolchain on cdoctest by "python -m clang_repl_kernel --install-default-toolchain".');
				return;
			}

			getToolchainDir(exeConfig!).then((toolChainDir: any) => {
				if (!toolChainDir) {
					console.error('Error getting toolchain of clang_repl_kernel directory. Toolchain on clang_repl_kernel is not set or installed.');
					return;
				}
				console.log('Clang REPL kernel toolchain directory:', toolChainDir);
				addNewToolchain(toolChainDir);
			}).catch((error: any) => {
				console.error('Error getting toolchain or clang_repl_kernel directory:', error);
				return;
			});
		}).catch((error: any) => {
			console.error('Error checking cdoctest version:', error);
			return;
		});
	}
	vscode.workspace.onDidChangeWorkspaceFolders(ativeWorkspace);
	if (vscode.workspace.workspaceFolders) {
        ativeWorkspace();
    }
	
}



