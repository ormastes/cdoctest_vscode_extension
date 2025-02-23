
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { Config } from './config';
import * as readline from 'readline';

export async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (err: any) {
        // File doesn't exist if the error indicates a missing file.
        if (err.code === 'FileNotFound' || err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}


export async function runner(run_args: string[] | undefined, buildDirectory: string, isUseFile: boolean, resultFile: string, config: Config, cancelSource: vscode.CancellationTokenSource | undefined, resultHandler: ((result: string) => void)): Promise<void> {
    if (!run_args) {
        return;
    }
    if (!cancelSource) {
        return;
    }
    return new Promise(async (resolve, reject) => {
        const token = cancelSource.token;
        // If a refresh is already in progress, cancel it.
        //if (cancelSource) {
        //refreshCancellationSource.cancel();
        //refreshCancellationSource.dispose();
        //return;
        //}
        
        const executable = process.platform === 'win32' ? run_args[0].replaceAll('/', '\\') : run_args[0].replaceAll('\\', '/');


        const fileUri = vscode.Uri.file(executable);
        const exist = await fileExists(fileUri);
        if (!exist) {
            if (!config.useCmakeTarget) {
                reject('Tets Target File does not exist.');
            }
        }
        if (config.useCmakeTarget) {
            if (!config.cmakeProject) {
                reject('CMake project is not initialized.');
            }
            try {
                // Trigger the build—without specifying targets, this builds the active target
                // not build always... TODO: await config.cmakeProject?.build();
                // console.log('Build succeeded!');
            } catch (err) {
                reject(err);
            }
        }


        const args = run_args.slice(1);

        const cdocRefreshProcess = spawn(
            executable,
            args,
            { cwd: buildDirectory, shell: true  }
        );
        if (!cdocRefreshProcess) {
            return;
        }
        try {
            const childRl = readline.createInterface({
                input: cdocRefreshProcess.stdout!,
                output: process.stdout,
                terminal: false
            });
            const result: string[] = [];
            const childLineHandler = (line: string) => {
                if (isUseFile) {
                    console.log(`stdout: ${line}`);
                } else {
                    result.push(line);
                }
            };

            childRl.on('line', (line) => {
                try {
                    childLineHandler(line);
                } catch (error) {
                    console.error(`Child process error: ${error}`);
                    if (cdocRefreshProcess !== undefined) {
                        cdocRefreshProcess.kill();
                    }
                    reject(error);
                }
            });
            cdocRefreshProcess.on('error', (error) => {
                console.error(`Child process error: ${error}`);
                if (cdocRefreshProcess !== undefined) {
                    cdocRefreshProcess.kill();
                }
                reject(error);
            });
            cdocRefreshProcess.on('close', async (code) => {
                vscode.window.showInformationMessage(`Test executable exited with code ${code}`);
                //cdocRefreshProcess = undefined;
                //refreshCancellationSource?.dispose();
                //refreshCancellationSource = undefined;
                let testList: string;
                if (isUseFile) {
                    const resultUri = vscode.Uri.file(resultFile);
                    // read resultUri and make testList string
                    try {
                        const resultBuffer = await vscode.workspace.fs.readFile(resultUri);
                        testList = Buffer.from(resultBuffer).toString('utf-8');
                        resultHandler(testList);
                    } catch (error) {
                        console.error(`Error reading result file: ${error}`);
                        reject(error);
                    }
                } else {
                    testList = result.join('\n');
                    resultHandler(testList);
                }
                // Manually monitor cancellation token.
                token.onCancellationRequested(() => {
                    console.log('cancellation requested');
                    if (cdocRefreshProcess) {
                        cdocRefreshProcess.kill();
                    }
                });
                resolve();
            });
        } catch (error) {
            if (cdocRefreshProcess.exitCode === 0) {
                console.log(`child process exited with code ${cdocRefreshProcess.exitCode}`);
                resolve();
            } else {
                console.error(`Child process error: ${error}`);
                if (cdocRefreshProcess) {
                    cdocRefreshProcess.kill();
                }
                reject(error);
            }
        }
    });
}