
import * as vscode from 'vscode';
import { Config } from './config';
import * as readline from 'readline';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as os from 'os';

/**
 * Retrieves a launch configuration from workspace settings by its name.
 */
async function getLaunchConfigurationByName(name: string): Promise<vscode.DebugConfiguration | undefined> {
    const launchConfigs = vscode.workspace.getConfiguration('launch').get<any[]>('configurations');
    if (!launchConfigs) {
      return undefined;
    }
    return launchConfigs.find(cfg => cfg.name === name);
  }

/**
 * Launches a debug session with the given parameters.
 *
 * @param program - The full path to the executable.
 * @param args - The command-line arguments.
 * @param workingDirectory - The working directory for the process.
 * @param envVars - An object containing environment variables.
 */
export async function launchDebugSessionWithCloseHandler(
    configName: string,
    program: string,
    args: string[],
    workingDirectory: string,
    resultFile: string,
    resultHandler: ((result: string) => void),
    resolve: ()=>void,
    reject: (reason?: any) => void,
    envVars: { [key: string]: string }
): Promise<void> {
    const baseConfig = await getLaunchConfigurationByName(configName);
    // Make a shallow copy so we don't alter the stored settings.
    let debugConfig: vscode.DebugConfiguration = (baseConfig)? { ...baseConfig } : { type: '', name: '', request: '' };

    if (debugConfig.type === undefined || debugConfig.type === '') {
        debugConfig.type = 'lldb-dap';
    }
    if (debugConfig.name === undefined || debugConfig.name === '') {
        debugConfig.name = 'Debug Program';
    }
    if (debugConfig.request === undefined || debugConfig.request === '') {
        debugConfig.request = 'launch';
    }
    if (debugConfig.stopAtEntry === undefined || debugConfig.stopAtEntry === '') {
        debugConfig.stopAtEntry = false;
    }
    debugConfig.program = program;
    debugConfig.args = args;
    debugConfig.cwd = workingDirectory;
    debugConfig.env = envVars;


    const started = await vscode.debug.startDebugging(undefined, debugConfig);
    if (!started) {
        vscode.window.showErrorMessage('Failed to start debugging session.');
    }

    // Attach a listener for when any debug session terminates.
    const terminationListener = vscode.debug.onDidTerminateDebugSession(async (session) => {
        // Filter based on the session name (or you could use session.id if preferred).
        if (session.name === debugConfig.name) {
            console.log(`Debug session "${session.name}" has terminated with exit code (if available)`);
            // Perform any cleanup or further actions here.

            await getResultFromFile(resultFile, resultHandler, reject);

            // Dispose the listener since it's no longer needed.
            terminationListener.dispose();
        }
    });
}


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
    configName: string,
    program: string,
    args: string[],
    libPaths: string,
    buildDirectory: string,
    resultFile: string,
    resultHandler: ((result: string) => void),
    resolve: ()=>void,
    reject: (reason?: any) => void,
    isDebug: boolean
): ChildProcess | Promise<void> {
    // Clone the current process environment
    const env: { [key: string]: string } = {};
    for (const key in process.env) {
        if (process.env[key] !== undefined) {
            env[key] = process.env[key] as string;
        }
    }

    // Depending on the platform, inject the library search path variable.
    if (os.platform() === 'win32') {
        // For Windows, modify PATH (use semicolon as separator)
        let pathName = "PATH";
        for (let key in env) {
            if (key.toLowerCase() === "path") {
                pathName = key;
                break;
            }
        }
        const currentPath = ';' + env[pathName] || '';
        env[pathName] = libPaths + currentPath;
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

    if (isDebug) {
        return launchDebugSessionWithCloseHandler(
            configName, program, args, buildDirectory, resultFile, resultHandler, resolve, reject, env);
    } else {
        // Default spawn options: use our modified environment and inherit stdio.
        const spawnOptions: SpawnOptions = {
            env,
            cwd: buildDirectory,
            shell: true
        };
        // Spawn the process and return the ChildProcess to the caller.
        return spawn(program, args, spawnOptions);
    }
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


export async function runner(run_args: string[] | undefined, buildDirectory: string, isUseFile: boolean, resultFile: string, config: Config, 
        cancelSource: vscode.CancellationTokenSource | undefined, resultHandler: ((result: string) => void), isDebug:boolean = false): Promise<void> {
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
            config.configName,
            executable,
            args,
            config.libPaths,
            buildDirectory,
            config.resultFile,
            resultHandler,
            resolve,
            reject,
            isDebug
        );

        if (!cdocRefreshProcess) {
            return;
        }
        if (cdocRefreshProcess instanceof Promise) {
            await cdocRefreshProcess;
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
                if (isUseFile) {
                    await getResultFromFile(resultFile, resultHandler, reject);
                } else {
                    const testList = result.join('\n');
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

async function getResultFromFile(resultFile: string, resultHandler: (result: string) => void, reject: (reason?: any) => void) {
    const resultUri = vscode.Uri.file(resultFile);
    // read resultUri and make testList string
    try {
        const resultBuffer = await vscode.workspace.fs.readFile(resultUri);
        const testList = Buffer.from(resultBuffer).toString('utf-8');
        resultHandler(testList);
    } catch (error) {
        console.error(`Error reading result file: ${error}`);
        reject(error);
    }
}
