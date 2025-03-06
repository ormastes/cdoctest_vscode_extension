// src/extension.ts
import * as vscode from 'vscode';
import { Config, ExeConfig } from './config';
import { MarkdownFileCoverage } from './coverage';
import { setupController } from './controller/controller';
import { initRunner } from './runner';
import { checkCDocTestVersion, getToolchainDir,  addNewToolchain, checkToolchainInstalled} from './pyAdapter';


let exeConfig: Config | undefined;
let cdocConfig: Config | undefined;
let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	initRunner(context);

	async function _ativeWorkspace(config: Config | ExeConfig) {

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
		exeConfig = await new ExeConfig(context, newWorkspace, _ativeWorkspace);
		cdocConfig = await new Config(context, newWorkspace, _ativeWorkspace);
		checkCDocTestVersion(exeConfig).then(async(installed: any) => {
			if (!installed) {
				console.error('Error checking cdoctest version not met minimum required version:', exeConfig?.cdoctest_min_version);
				console.error('Please install the cdoctest on python by "python -m pip install --upgrade cdoctest".');
				process.exit(1);
			} 
			if (!await checkToolchainInstalled(exeConfig!)) {
				console.error('Error checking cdoctest toolchain. Toolchain on cdoctest is not set or installed.');
				console.error('Please install the toolchain on cdoctest by "python -m clang_repl_kernel --install-default-toolchain".');
				process.exit(1);
			}

			getToolchainDir(exeConfig!).then((toolChainDir: any) => {
				if (!toolChainDir) {
					console.error('Error getting toolchain of clang_repl_kernel directory. Toolchain on clang_repl_kernel is not set or installed.');
					process.exit(1);
				}
				console.log('Clang REPL kernel toolchain directory:', toolChainDir);
				addNewToolchain(toolChainDir);
			}).catch((error: any) => {
				console.error('Error getting toolchain or clang_repl_kernel directory:', error);
				process.exit(1);
			});
		}).catch((error: any) => {
			console.error('Error checking cdoctest version:', error);
			process.exit(1);
		});
	}
	vscode.workspace.onDidChangeWorkspaceFolders(ativeWorkspace);
	if (vscode.workspace.workspaceFolders) {
        ativeWorkspace();
    }
	
}



