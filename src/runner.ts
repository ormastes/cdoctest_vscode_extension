
import * as vscode from 'vscode';
import { Config } from './config';
import * as readline from 'readline';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as os from 'os';
import { fileExists } from './util';
import * as fs from 'fs';
import * as path from 'path';

let stdoutLines: { [key: string]: string[] } = {};

function addStdoutLine(sessionId: string, line: string) {
    stdoutLines[sessionId].push(line);
}
function addSpawnListeners(cdocRefreshProcess: ChildProcess, sessionName:string, sessionId: string,  isUseFile:boolean, 
        resultFile:string, handlClose: (sessionName: string, sessionId: string, exitCode?: number) => Promise<void>, 
        resolve: () => void, reject: (reason?: any) => void) {
    try {
    let buffer = '';
    const childLineHandler = (line: string) => {
        if (isUseFile) {
            console.log(`stdout: ${line}`);
        } else {
            addStdoutLine(sessionId, line);
        }
    };

    cdocRefreshProcess.stdout?.on('data', (data) => {
        try {
            buffer += data.toString();
            const lines = buffer.split('\n');
            // Keep the last part (might be incomplete line)
            buffer = lines.pop() || '';
            
            // Process complete lines
            for (const line of lines) {
                 if (line.trim().toLowerCase().startsWith('warning:') || line.trim().toLowerCase().startsWith('error:')) {
                    console.warn(`Warning/Error from child process: ${line}`);
                    continue;
                }
                childLineHandler(line);
            }
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
        // Ensure we resolve even on error to prevent hanging
        handlClose(sessionName, sessionId, 1);
        resolve();
    });
    cdocRefreshProcess.on('close', async (code) => {
        // Process any remaining buffer content
        if (buffer.length > 0) {
            try {
                childLineHandler(buffer);
            } catch (error) {
                console.error(`Child process error processing remaining buffer: ${error}`);
            }
        }
        handlClose(sessionName, sessionId, code || undefined);
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
}

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
                            addStdoutLine(session.id, outputStr);
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
    controllerId: string,
    program: string,
    args: string[],
    workingDirectory: string,
    resultFile: string,
    resultHandler: ((result: string, exitCode?: number) => void),
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
        // Auto-detect debugger based on platform
        if (process.platform === 'win32') {
            // Check if Visual Studio debugger is available
            debugConfig.type = 'cppvsdbg';  // Visual Studio debugger
        } else if (process.platform === 'linux') {
            debugConfig.type = 'cppdbg';  // GDB debugger
        } else {
            debugConfig.type = 'lldb-dap';  // LLDB for macOS and fallback
        }
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

    async function handlClose(sessionName: string, sessionId:string, exitCode?: number): Promise<void> {
        // Filter based on the session name (or you could use session.id if preferred).
        if (sessionName === debugConfig.name) {
            console.log(`Debug session "${sessionName}" has terminated with exit code (if available)`);
            // Perform any cleanup or further actions here.
            if (isUseFile) {
                if (! await fileExists(vscode.Uri.file(resultFile))) {
                    // If no result file, pass error message with exit code
                    const errorMsg = exitCode !== 0 
                        ? `Test failed with exit code ${exitCode}. No result file found at ${resultFile}`
                        : `No result file found at ${resultFile}`;
                    resultHandler(errorMsg, exitCode);
                    return;
                }
                await getResultFromFile(resultFile, resultHandler, reject, exitCode);
            } else {
                if (!stdoutLines[sessionId]) {
                    // No stdout captured, report with exit code
                    const errorMsg = exitCode !== 0 
                        ? `Test failed with exit code ${exitCode}. No output captured`
                        : 'Test completed with no output';
                    resultHandler(errorMsg, exitCode);
                    return;
                }
                let output = stdoutLines[sessionId].join('\n');
                resultHandler(output, exitCode);
            }
            // Clear the stored output for this session.
            if (stdoutLines[sessionId]) {
                delete stdoutLines[sessionId];
            }
        }
    }

    if (!isDebug) {
        debugConfig.noDebug = true;
    }
    function initStdout(sessionId: string) {
        if (!isUseFile) {
            stdoutLines[sessionId] = [];
        }
    }
    // capture session start event
    const result = vscode.debug.onDidStartDebugSession(async (session) => {
        // Only handle sessions that match our configuration
        if (session.configuration.name !== debugConfig.name || 
            session.type !== debugConfig.type) {
            return;
        }
        initStdout(session.id);
        // Attach a listener for when any debug session terminates.
        const terminationListener = vscode.debug.onDidTerminateDebugSession(async (terminatedSession) => {
            // Only handle our specific session
            if (terminatedSession.id === session.id) {
                // Debug sessions don't provide exit codes directly
                await handlClose(terminatedSession.name, terminatedSession.id, undefined);
                terminationListener.dispose();
            }
        });
        // remove the listener
        result.dispose();
    });
    if (controllerId === "cdoctest" ) {
        if (stdoutLines[debugConfig.controllerId]) {
            console.warn("cdoctest is already running.");
            return;
        }
        initStdout(debugConfig.controllerId);
        // Default spawn options: use our modified environment and inherit stdio.
        const spawnOptions: SpawnOptions = {
            env: envVars,
            cwd: workingDirectory,
            shell: true
        };
        // Spawn the process and return the ChildProcess to the caller.
        const proc = spawn(program, args, spawnOptions);
        addSpawnListeners(proc, debugConfig.name, debugConfig.controllerId, isUseFile, resultFile, handlClose, resolve, reject);
    } else {
        try {
            const started = await vscode.debug.startDebugging(undefined, debugConfig);
            if (!started) {
                vscode.window.showErrorMessage('Failed to start debugging session.', 'OK');
            }
        } catch (error) {
            console.warn('Error starting debugging session:', error);
            reject(error);
        }
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
    constrollerId: string,
    program: string,
    args: string[],
    libPaths: string,
    buildDirectory: string,
    resultFile: string,
    resultHandler: ((result: string, exitCode?: number) => void),
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
        configName, constrollerId, program, args, buildDirectory, resultFile, 
        resultHandler, resolve, reject, env, isUseFile, isDebug);
}


export async function runner(run_args: string[] | undefined, buildDirectory: string, isUseFile: boolean, resultFile: string, config: Config, 
        cancelSource: vscode.CancellationTokenSource | undefined, resultHandler: ((result: string, exitCode?: number) => void), isDebug:boolean = false): Promise<void> {
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
            config.controllerId,
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

async function getResultFromFile(resultFile: string, resultHandler: (result: string, exitCode?: number) => void, reject: (reason?: any) => void, exitCode?: number) {
    const resultUri = vscode.Uri.file(resultFile);
    // read resultUri and make testList string
    try {
        const resultBuffer = await vscode.workspace.fs.readFile(resultUri);
        const testList = Buffer.from(resultBuffer).toString('utf-8');
        resultHandler(testList, exitCode);
    } catch (error) {
        console.error(`Error reading result file: ${error}`);
        // Call resultHandler with error message to ensure test completes
        resultHandler(`Error reading result file: ${error}`, exitCode);
    }
}
