// src/extension.ts
import * as vscode from 'vscode';
import { Config } from './config';
import { MarkdownFileCoverage } from './coverage';
import { setupController } from './controller';
import { checkCDocTestVersion, getToolchainDir,  addNewToolchain} from './pyAdapter';


let currentConfig: Config | undefined;
let lastWorkspace: vscode.WorkspaceFolder | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();

	async function _ativeWorkspace(config: Config) {

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
		if (currentConfig) {
			currentConfig.dispose();
		}
		currentConfig = await new Config(context, newWorkspace, _ativeWorkspace);
		checkCDocTestVersion(currentConfig).then((installed: any) => {
			if (!installed) {
				console.error('Error checking cdoctest version not met minimum required version:', currentConfig?.cdoctest_min_version);
				process.exit(1);
			} 
			getToolchainDir(currentConfig!).then((toolChainDir: any) => {
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



