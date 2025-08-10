import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Config } from './config';
import path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 > num2) { return 1; }
        if (num1 < num2) { return -1; }
    }
    return 0;
}
interface CMakeKit {
    name: string;
    compilers?: {
      C?: string;
      CXX?: string;
      [key: string]: string | undefined;
    };
    // Add additional fields as needed.
  }
  
  /**
   * Adds a new kit to the workspace's cmake-kits.json file.
   *
   * @param binDir - The absolute path to the directory containing compiler executables.
   * @param kitsFilePath - The full path to the kits file (e.g. workspaceFolder/.vscode/cmake-kits.json).
   */
  async function addCMakeKitToWorkspace(binDir: string, kitsFilePath: string): Promise<void> {
    // Define expected compiler paths using the provided binary directory.
    const clangPath = path.join(binDir, process.platform === 'win32' ? 'clang.exe' : 'clang');
    const clangPPPath = path.join(binDir, process.platform === 'win32' ? 'clang++.exe' : 'clang++');
  
    const newKit: CMakeKit = {
      name: `Kit from ${binDir}`,
      compilers: {
        C: clangPath,
        CXX: clangPPPath,
      }
    };
  
    let kits: CMakeKit[] = [];
    try {
      const fileData = await fs.promises.readFile(kitsFilePath, 'utf8');
      kits = JSON.parse(fileData) as CMakeKit[];
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        vscode.window.showErrorMessage(`Error reading kits file: ${error.message}`, 'OK');
        throw error;
      }
      // File doesn't exist, start with empty array.
      kits = [];
    }
  
    // Avoid duplicate: check if kit with same compiler paths exists.
    const duplicate = kits.find(
      kit => kit.compilers?.C === clangPath && kit.compilers?.CXX === clangPPPath
    );
    if (duplicate) {
      vscode.window.showInformationMessage(`A kit for "${binDir}" is already added.`, 'OK');
      return;
    }
  
    kits.push(newKit);
    const jsonStr = JSON.stringify(kits, null, 2);
    try {
      await fs.promises.writeFile(kitsFilePath, jsonStr, { encoding: 'utf8' });
      vscode.window.showInformationMessage(`New kit added: "${newKit.name}".`, 'OK');
      vscode.window.showWarningMessage(`Remember to select the new kit in CMake Tools if you wish to use it.`, 'OK');
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to update kits file: ${error.message}`, 'OK');
    }
  }
export async function addNewToolchain(binDir: string): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showInformationMessage('No workspace open. Waiting for a workspace folder to be added...', 'OK');
      // Listen for changes to workspace folders.
      const disposable = vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          disposable.dispose();
          const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
          const kitsFilePath = path.join(workspaceFolder, '.vscode', 'cmake-kits.json');
          await addCMakeKitToWorkspace(binDir, kitsFilePath);
        }
      });
    } else {
      const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const kitsFilePath = path.join(workspaceFolder, '.vscode', 'cmake-kits.json');
      await addCMakeKitToWorkspace(binDir, kitsFilePath);
    }
  }

export async function checkToolchainInstalled(config: Config): Promise<boolean> {
    // The command prints the directory where clang_repl_kernel.__file__ is located.
    const command = `${config.pythonExePath} -c "from clang_repl_kernel import ClangReplConfig; import platform; from clang_repl_kernel import is_installed_clang_exist; print( is_installed_clang_exist());"`;

    try {
        const { stdout, stderr } = await execAsync(command);
        // get directory path
        const is_installed_clang_exist= stdout.trim().toLowerCase().includes('true');
        if (is_installed_clang_exist) {
          return Promise.resolve(is_installed_clang_exist);
        }
        if (stderr) {
            console.error('Error output:', stderr);
            return Promise.reject(stderr);
        }
        return Promise.resolve(is_installed_clang_exist);
    } catch (error) {
        console.error('Failed to get clang_repl_kernel directory:', error);
        return Promise.reject(error);
    }
}
export async function getToolchainDir(config: Config): Promise<string> {
    // The command prints the directory where clang_repl_kernel.__file__ is located.
    const command = `${config.pythonExePath} -c "from clang_repl_kernel import ClangReplConfig; import platform; from clang_repl_kernel import install_bundles; install_bundles(platform.system(), None); print( ClangReplConfig.get_bin_path());"`;

    try {
        const { stdout, stderr } = await execAsync(command);

        // get directory path
        const toolchainExecutable = stdout.trim().replaceAll('\\', '/');
        const toolchainDir = toolchainExecutable.substring(0, toolchainExecutable.lastIndexOf('/'));
        if (toolchainDir.trim().length !== 0) {
            return toolchainDir;
        }
        
        if (stderr) {
            console.error('Error output:', stderr);
            return Promise.reject(stderr);
        }
        
        return toolchainDir;
    } catch (error) {
        console.error('Failed to get clang_repl_kernel directory:', error);
        return Promise.reject(error);
    }
}
export async function runInstallBundles(config: Config): Promise<void> {
    // Build the command:
    // The Python one-liner imports platform, then from clang_repl_kernel import install_bundles,
    // and finally calls install_bundles(platform.system(), None)
    const command = `${config.pythonExePath} -c "import platform; from clang_repl_kernel import install_bundles; install_bundles(platform.system(), None);"`;

    try {
        const { stdout, stderr } = await execAsync(command);
        console.log('Output:', stdout);
        if (stderr) {
            console.error('Error output:', stderr);
            return Promise.reject(stderr);
        }
    } catch (error) {
        console.error('Failed to run install_bundles:', error);
        return Promise.reject(error);
    }
}

export async function installCDocTest(config: Config, requiredVersion: string | undefined = undefined): Promise<void> {
    if (!requiredVersion) {
        requiredVersion = config.cdoctest_min_version;
    }
    // Construct the pip install command with version specifier (>=1.1.0)
    const packageSpec = 'cdoctest>=' + requiredVersion;
    const command = `"${config.pythonExePath}" -m pip install ${packageSpec}`;

    try {
        const { stdout, stderr } = await execAsync(command);
        console.log('Installation output:', stdout);
        if (stderr) {
            console.error('Installation error output:', stderr);
            return Promise.reject(stderr);
        }
    } catch (error) {
        console.error('Error running pip install command:', error);
        return Promise.reject(error);
    }
}
export async function checkCDocTestVersion(config: Config, requiredVersion: string | undefined = undefined): Promise<boolean> {
    if (!requiredVersion) {
        requiredVersion = config.cdoctest_min_version;
    }
    const command = `"${config.pythonExePath}" -m pip show cdoctest`;

    try {
        const { stdout } = await execAsync(command);
        // pip show outputs multiple lines; we look for a line like "Version: 1.1.0"
        const lines = stdout.split('\n');
        const versionLine = lines.find(line => line.toLowerCase().startsWith('version:'));
        if (!versionLine) {
            console.warn('Version info not found; cdoctest may not be installed.');
            return false;
        }
        const installedVersion = versionLine.split(':')[1]?.trim();
        if (!installedVersion) {
            console.warn('Unable to parse installed version.');
            return false;
        }
        const cmp = compareVersions(installedVersion, requiredVersion);
        console.log(`Installed cdoctest version: ${installedVersion} (required >= ${requiredVersion})`);
        return cmp >= 0;
    } catch (error: any) {
        if (error.code === 1) {
            // pip show returns an error code if the package is not installed.
            console.warn('cdoctest is not installed.');
            return false;
        }
        console.error('Error checking cdoctest version:', error);
        throw error;
    }
}



