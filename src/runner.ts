
import * as vscode from 'vscode';
import { Config } from './config';
import * as readline from 'readline';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as os from 'os';
import { fileExists } from './util';

let stdoutLines: { [key: string]: string[] } = {};

export function initRunner(context: vscode.ExtensionContext) {
    const trackerFactory = {
        createDebugAdapterTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker {
            return {
                onDidSendMessage: message => {
                    // Check if the message is an output event
                    if (message.type === 'event' && message.event === 'output') {
                        const output = message.body;
                        // Check if the output is from stdout
                        if (output.category === 'stdout' && stdoutLines[session.id]) {
                            const outputStr = output.output.trim();
                            stdoutLines[session.id].push(outputStr);
                        }
                    }
                }
            };
        }
    };

    // Register the tracker factory for a specific debug type, e.g., 'node'
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('lldb-dap', trackerFactory));
}

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
    envVars: { [key: string]: string },
    isUseFile: boolean,
    isDebug: boolean
): Promise<void> {
    // check program file exists
    if (!program || await fileExists(vscode.Uri.file(program)) === false) {
        reject('Program file does not exist.');
        return;
    }
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
    debugConfig.program = program;
    debugConfig.args = args;
    debugConfig.cwd = workingDirectory;
    debugConfig.env = envVars;

    async function handlClose(session: vscode.DebugSession): Promise<void> {
        // Filter based on the session name (or you could use session.id if preferred).
        if (session.name === debugConfig.name) {
            console.log(`Debug session "${session.name}" has terminated with exit code (if available)`);
            // Perform any cleanup or further actions here.
            if (isUseFile) {
                if (! await fileExists(vscode.Uri.file(resultFile))) {
                    return;
                }
                await getResultFromFile(resultFile, resultHandler, reject);
            } else {
                if (!stdoutLines[session.id]) {
                    return;
                }
                let output = stdoutLines[session.id].join('\n');
                resultHandler(output);
            }
            // Clear the stored output for this session.
            if (stdoutLines[session.id]) {
                delete stdoutLines[session.id];
            }
        }
    }

    if (!isDebug) {
        debugConfig.noDebug = true;
    }
    // capture session start event
    const result = vscode.debug.onDidStartDebugSession(async (session) => {
        if (!isUseFile) {
            stdoutLines[session.id] = [];
        }
        // Attach a listener for when any debug session terminates.
        const terminationListener = vscode.debug.onDidTerminateDebugSession(async (session) => {
            await handlClose(session);
            terminationListener.dispose();
        });
        // remove the listener
        result.dispose();
    });
    try {
        const started = await vscode.debug.startDebugging(undefined, debugConfig);
        if (!started) {
            vscode.window.showErrorMessage('Failed to start debugging session.');
        }
    } catch (error) {
        reject(error);
    }
    result;
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
    isUseFile: boolean,
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

    return launchDebugSessionWithCloseHandler(
        configName, program, args, buildDirectory, resultFile, 
        resultHandler, resolve, reject, env, isUseFile, isDebug);
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

        runProgramWithLibPaths(
            config.configName,
            executable,
            args,
            config.libPaths,
            buildDirectory,
            resultFile,
            resultHandler,
            resolve,
            reject,
            isUseFile,
            isDebug
        );
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
