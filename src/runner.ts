
import * as vscode from 'vscode';
import { Config } from './config';
import * as readline from 'readline';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as os from 'os';

/**
 * Spawns a program while ensuring that the dynamic linker can locate the shared libraries.
 * Returns the ChildProcess so that the caller can attach event listeners as needed.
 *
 * @param program - Path to the executable program.
 * @param args - Array of arguments to pass to the executable.
 * @param libPaths - Array of directories (using forward slashes) to add to the dynamic library search paths.
 * @param additionalOptions - (Optional) Additional spawn options to merge with defaults.
 * @returns The spawned ChildProcess.
 */
export function runProgramWithLibPaths(
  program: string,
  args: string[],
  libPaths: string,
  additionalOptions?: SpawnOptions
): ChildProcess {
  // Clone the current process environment
  const env = { ...process.env };

  // Depending on the platform, inject the library search path variable.
  if (os.platform() === 'win32') {
    // For Windows, modify PATH (use semicolon as separator)
    const currentPath = env.PATH || '';
    env.PATH = libPaths + currentPath;
  } else if (os.platform() === 'linux') {
    // For Linux, modify LD_LIBRARY_PATH (use colon as separator)
    const currentLD = env.LD_LIBRARY_PATH || '';
    libPaths.replaceAll(';', ':');
    env.LD_LIBRARY_PATH = libPaths + (currentLD ? ':' + currentLD : '');
  } else if (os.platform() === 'darwin') {
    // For macOS, modify DYLD_LIBRARY_PATH (use colon as separator)
    const currentDYLD = env.DYLD_LIBRARY_PATH || '';
    libPaths.replaceAll(';', ':');
    env.DYLD_LIBRARY_PATH = libPaths + (currentDYLD ? ':' + currentDYLD : '');
  }

  // Default spawn options: use our modified environment and inherit stdio.
  const defaultOptions: SpawnOptions = {
    env
  };

  // Merge any additional options passed by the caller
  const spawnOptions = { ...defaultOptions, ...additionalOptions };

  // Spawn the process and return the ChildProcess to the caller.
  return spawn(program, args, spawnOptions);
}


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

        const cdocRefreshProcess = runProgramWithLibPaths(
            executable,
            args,
            config.libPaths,
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