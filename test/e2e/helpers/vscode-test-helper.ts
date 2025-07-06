import * as path from 'path';
import { downloadAndUnzipVSCode, runTests, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import { spawn } from 'child_process';
import * as fs from 'fs';

export interface TestOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs?: string[];
  vscodeExecutablePath?: string;
  version?: string;
}

export class VSCodeTestHelper {
  private vscodeExecutablePath: string | undefined;
  
  async downloadVSCode(version: string = 'stable'): Promise<string> {
    this.vscodeExecutablePath = await downloadAndUnzipVSCode(version);
    return this.vscodeExecutablePath;
  }

  async installExtensions(extensions: string[]): Promise<void> {
    if (!this.vscodeExecutablePath) {
      throw new Error('VS Code executable path not found. Please download VS Code first.');
    }

    const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(this.vscodeExecutablePath);
    
    for (const extension of extensions) {
      console.log(`Installing extension: ${extension}`);
      
      await new Promise<void>((resolve, reject) => {
        const install = spawn(cli, [...args, '--install-extension', extension, '--force'], {
          encoding: 'utf-8',
          stdio: 'inherit'
        });
        
        install.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Failed to install extension ${extension}`));
          } else {
            resolve();
          }
        });
      });
    }
  }

  async runTests(options: TestOptions): Promise<void> {
    const extensionDevelopmentPath = options.extensionDevelopmentPath;
    const extensionTestsPath = options.extensionTestsPath;
    const vscodeExecutablePath = options.vscodeExecutablePath || this.vscodeExecutablePath;

    if (!vscodeExecutablePath) {
      throw new Error('VS Code executable path not found. Please download VS Code first.');
    }

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: options.launchArgs || ['--disable-extensions'],
    });
  }

  async launchVSCode(workspacePath: string, extensionPath: string): Promise<any> {
    const vscodeExecutablePath = this.vscodeExecutablePath;
    if (!vscodeExecutablePath) {
      throw new Error('VS Code executable path not found. Please download VS Code first.');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--extensionDevelopmentPath=' + extensionPath,
        '--disable-extensions',
        '--new-window',
        workspacePath
      ];

      const vscodeProcess = spawn(vscodeExecutablePath, args, {
        detached: false,
        shell: false
      });

      vscodeProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });

      vscodeProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });

      vscodeProcess.on('error', (error) => {
        reject(error);
      });

      // Give VS Code some time to start
      setTimeout(() => {
        resolve(vscodeProcess);
      }, 5000);
    });
  }
}