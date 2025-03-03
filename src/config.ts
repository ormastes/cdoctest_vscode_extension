
import * as vscode from 'vscode';
import { CMakeToolsApi, getCMakeToolsApi, Project, Version } from 'vscode-cmake-tools';

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

interface Artifact {
  path: string;
}

interface TargetReply {
  nameOnDisk?: string;
  artifacts?: Artifact[];
}



export async function getExecutablePath(buildType: string, buildDir: string, targetName: string): Promise<string | undefined> {
  // Use posix-style paths (i.e. forward slashes) and replace any backslashes in buildDir
  const normalizedBuildDir = buildDir.replace(/\\/g, '/');
  const pattern = path.posix.join(normalizedBuildDir, '.cmake/api/v1/reply', `target-${targetName}-*`);


  let _files = await fg(pattern);
  let files = _files.filter(file => path.extname(file) === '.json');
  if (files.length === 0) {
    console.warn(`No CMake reply file found for target "${targetName}" using pattern "${pattern}"`);
    return undefined;
  }
  if (files.length > 1) {
    _files = files;
    files = _files.filter(file => path.basename(file).startsWith(`target-${targetName}-${buildType}-`));
  }
  if (files.length === 0) {
    console.warn(`No CMake reply file found for target "${targetName}" and build type "${buildType}"`);
    // revert to the original list of
    files = _files;
  }

  // Pick the first matching reply file.
  const jsonFile = files[0];
  let reply: TargetReply;
  try {
    const data = await fs.promises.readFile(jsonFile, 'utf8');
    reply = JSON.parse(data) as TargetReply;
  } catch (error) {
    console.error(`Error reading or parsing ${jsonFile}:`, error);
    return undefined;
  }

  if (!reply.artifacts || reply.artifacts.length === 0) {
    console.warn(`No artifacts found in ${jsonFile}`);
    return undefined;
  }

  // Normalize the reply's nameOnDisk (if it exists) by replacing any backslashes with forward slashes.
  const normalizedNameOnDisk = reply.nameOnDisk ? reply.nameOnDisk.replace(/\\/g, '/') : undefined;

  // First, try to find an artifact whose path (normalized) ends with the reply-level nameOnDisk.
  let execPath: string | undefined = normalizedNameOnDisk
    ? reply.artifacts.find(artifact => artifact.path.replace(/\\/g, '/').endsWith(normalizedNameOnDisk))?.path
    : undefined;

  // If not found, fallback to the first artifact whose path (normalized) ends with ".exe" (case insensitive).
  if (!execPath) {
    execPath = reply.artifacts.find(artifact =>
      artifact.path.replace(/\\/g, '/').toLowerCase().endsWith('.exe')
    )?.path;
  }

  // append normalizedBuildDir if execPath is relative
    if (execPath && !path.isAbsolute(execPath)) {
        execPath = path.posix.join(normalizedBuildDir, execPath);
    }

  // Normalize the final path to use forward slashes.
  return execPath ? execPath.replace(/\\/g, '/') : undefined;
}

// # test run variable 
// ${test_suite_name}: Provided from vscode
// ${test_case_name}: Provided from vscode
// ${test_full_name}: ${test_suite_name}::${test_case_name}
//
// # configuration time variables
// ${workspaceFolder}: When configuration time.
// ${buildDirectory}: provided from settings.json or cmake
// ${srcDirectory}: provided from settings.json or cmake
//
//
// # cmake only
// ${cmakeTarget}: provided from cmake
//
export class Config {
    private workspaceFolder: vscode.WorkspaceFolder;
    public useCmakeTarget: boolean;
    public _pythonExePath: string;
    public cdoctest_min_version: string = '1.1.0';

	public _testRunArgPattern: string;
	public _listTestArgPattern: string;
    public _exe_testRunArgPattern: string;
    public _exe_listTestArgPattern: string;
    public _resultFile: string;
    public _exe_resultFile: string;
    public _resultSuccessRgex: string;

    public _srcDirectory: string;
    public _buildDirectory: string;
    public _executable: string;
    public _exe_executable: string;

    public testRunUseFile: boolean;
    public listTestUseFile: boolean;
    public exe_testRunUseFile: boolean;
    public exe_listTestUseFile: boolean;
    public libPaths: string;
    public configName: string;

    private _disposables: vscode.Disposable[] = [];

    public cmakeProject : Project | undefined;
    private cmakeTarget : string = "";
    private cmakeSrcDirectory : string = "";
    private cmakeBuildDirectory : string = "";
    private cmakeLaunchTargetPath : string = "";
    private cmakeBuildType : string = "";

    private skipWords: string[] = [];

    private cmakeApi: CMakeToolsApi | undefined;

    private activeWorkspace!: (config: Config) => void | undefined ;

    private covert_file_path(file: string, skipWord: string): string {
        this.skipWords.push(skipWord);
        file = this.convert(file, {});
        this.skipWords.pop();
        if (process.platform === 'win32') {
            return file.replaceAll('/', '\\');
        }
        return file.replaceAll('\\', '/');
    }

    // key should have ${test_full_name} and ${test_suite_name} and ${test_case_name}
    private convert(text: string, additionalEnv: { [key: string]: string }): string {
        let dic_applied_text = text;
        for (const key in additionalEnv) {
            dic_applied_text = dic_applied_text.replace('${' + key + '}', additionalEnv[key]);
        }
        let result = dic_applied_text;
        for (let i = 0; i < 4; i++) {
            if(!this.skipWords.includes("buildDirectory")) {result = result.replace('${buildDirectory}', this.buildDirectory);}
            if(!this.skipWords.includes("srcDirectory")) {result = result.replace('${srcDirectory}', this.srcDirectory);}
            result = result.replace('${workspaceFolder}', this.workspaceFolder.uri.fsPath);
            if (this.useCmakeTarget) {
                result = result.replace('${cmakeTarget}', this.cmakeTarget);
            }
            if (result.indexOf('${') === -1) {
                break;
            }
        }
        return result;
    }
    public _get_testrun_executable_args(executable: string, additionalEnv: { [key: string]: string }): string[] {
        additionalEnv['test_full_name'] = additionalEnv['test_suite_name'] + '::'+additionalEnv['test_case_name'];
        let result = this.convert(executable, additionalEnv);
        return result.split(' ');
    }

    public get_exe_testrun_executable_args(additionalEnv: { [key: string]: string }): string[] | undefined {
        if (this.exe_executable === "") { return undefined;}
        return this._get_testrun_executable_args(this.exe_executable +' ' + this._exe_testRunArgPattern, additionalEnv);
    }
    public get_testrun_executable_args(additionalEnv: { [key: string]: string }): string[] | undefined {
        if (this.executable === "") { return undefined;}
        return this._get_testrun_executable_args(this.executable +' ' + this._testRunArgPattern, additionalEnv);
    }
    public get pythonExePath(): string {
        return this.covert_file_path(this._pythonExePath, "pythonExePath");
    }
    public get exe_testrun_list_args(): string[] | undefined {
        if (this.exe_executable === "") { return undefined;}
        return this.convert(this.exe_executable +' ' + this._exe_listTestArgPattern, {}).split(' ');
    }
    public get testrun_list_args(): string[] | undefined {
        if (this.executable === "") { return undefined;}
        return this.convert(this.executable +' ' + this._listTestArgPattern, {}).split(' ');
    }
    public get resultFile(): string {
        return this.covert_file_path(this._resultFile, "resultFile");
    }
    public get exe_resultFile(): string {
        return this.covert_file_path(this._exe_resultFile, "exe_resultFile");
    }
    public get resultSuccessRgex(): string {
        return this.covert_file_path(this._resultSuccessRgex, "resultSuccessRgex");
    }

    public get exe_executable(): string {
        if (this.useCmakeTarget) {
            return this.cmakeLaunchTargetPath;
        }
        return this.covert_file_path(this._exe_executable, "exe_executable");
    }

    public async update_exe_executable(): Promise<void> {
        if (this.useCmakeTarget) {
            if (this.cmakeApi === undefined) {
                return;
            }
            return getExecutablePath(this.cmakeBuildType, this.cmakeBuildDirectory, this.cmakeTarget)
                        .then(targetPath => {
                            if (targetPath !== null) {
                                this.cmakeLaunchTargetPath = targetPath || "";
                            }
                        });
        } else {
            return Promise.resolve();
        }
    }

    public get executable(): string {
        if (this.useCmakeTarget) {
            let targetPath = this.cmakeLaunchTargetPath;
            if (targetPath === "") {
                return "";
            }
            // dynamic library, remove extension if it is by system
            const dotIndex = targetPath.lastIndexOf('.');
            const withoutExt = (dotIndex === -1) ? targetPath : targetPath.slice(0, dotIndex);
            let dynlib: string;
            if (process.platform === 'win32') {
                dynlib = withoutExt + '.dll';
            } else if (process.platform === 'darwin') {
                dynlib = withoutExt + '.dylib';
            } else {
                dynlib = withoutExt + '.so';
            }
            return this.covert_file_path(dynlib, "executable");
        }
        return this.covert_file_path(this._executable, "executable");
    }
    public get target(): string {
        if (this.useCmakeTarget) {
            return this.cmakeTarget;
        }
        return "";
    }
    
    public get srcDirectory(): string {
        if (this.useCmakeTarget) {
            return this.covert_file_path(this.cmakeSrcDirectory, "srcDirectory");
        }
        return this.covert_file_path(this._srcDirectory, "srcDirectory");
    }

    public get buildDirectory(): string {
        if (this.useCmakeTarget) {
            return this.covert_file_path(this.cmakeBuildDirectory, "buildDirectory");
        }
        return this.covert_file_path(this._buildDirectory, "buildDirectory");
    }

	constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, activeWorkspace: (config: Config) => void) {
        this.workspaceFolder = workspaceFolder;
        this.useCmakeTarget = vscode.workspace.getConfiguration('cdoctest').get('useCmakeTarget') as boolean;
        this._pythonExePath = vscode.workspace.getConfiguration('cdoctest').get('pythonExePath') as string;
		this._testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('testRunArgPattern') as string;
		this._listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('listTestArgPattern') as string;
        this._exe_testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_testRunArgPattern') as string;
		this._exe_listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_listTestArgPattern') as string;
        this._resultFile = vscode.workspace.getConfiguration('cdoctest').get('resultFile') as string;
        this._exe_resultFile = vscode.workspace.getConfiguration('cdoctest').get('exe_resultFile') as string;
        this._resultSuccessRgex = vscode.workspace.getConfiguration('cdoctest').get('resultSuccessRgex') as string;

        this._srcDirectory = vscode.workspace.getConfiguration('cdoctest').get('srcDirectory') as string;
        this._buildDirectory = vscode.workspace.getConfiguration('cdoctest').get('buildDirectory') as string;
        this._executable = vscode.workspace.getConfiguration('cdoctest').get('executable') as string;
        this._exe_executable = vscode.workspace.getConfiguration('cdoctest').get('exe_executable') as string;

        this.testRunUseFile = vscode.workspace.getConfiguration('cdoctest').get('testRunUseFile') as boolean;
        this.listTestUseFile = vscode.workspace.getConfiguration('cdoctest').get('listTestUseFile') as boolean;
        this.exe_testRunUseFile = vscode.workspace.getConfiguration('cdoctest').get('exe_testRunUseFile') as boolean;
        this.exe_listTestUseFile = vscode.workspace.getConfiguration('cdoctest').get('exe_listTestUseFile') as boolean;
        this.libPaths = vscode.workspace.getConfiguration('cdoctest').get('libPaths') as string;
        this.configName = vscode.workspace.getConfiguration('cdoctest').get('configName') as string;

        this.updateProject = this.updateProject.bind(this);

        if (this._pythonExePath === '') {
            throw new Error('cdoctest: pythonExePath must be set');
        }
        this.activeWorkspace  = activeWorkspace;

        if (this.useCmakeTarget) {
            // assert _srcDirectory and _buildDirectory are empty
            if (this._srcDirectory !== '' || this._buildDirectory !== '') {
                throw new Error('cdoctest: srcDirectory and buildDirectory must be empty when useCmakeTarget is true');
            }
            // assert _executable and _exe_executable are empty
            if (this._executable !== '' || this._exe_executable !== '') {
                throw new Error('cdoctest: executable and exe_executable must be empty when useCmakeTarget is true');
            }
        } else {
            // assert _srcDirectory and _buildDirectory are not empty
            if (this._srcDirectory === '' || this._buildDirectory === '') {
                throw new Error('cdoctest: srcDirectory and buildDirectory must be set when useCmakeTarget is false');
            }
            // assert _executable and _exe_executable are not empty
            if (this._executable === '' && this._exe_executable === '') {
                throw new Error('cdoctest: executable or exe_executable must be set when useCmakeTarget is false');
            }
        }

        if (!this.useCmakeTarget) {
            activeWorkspace(this);
        } else {
            getCMakeToolsApi(Version.v2, /*exactMatch*/ false).then(cmakeApi => {
                if (!cmakeApi) {
                    vscode.window.showErrorMessage('CMake Tools API is unavailable. Please install CMake Tools.');
                    return;
                }
                this.cmakeApi = cmakeApi;
                
                
                const configBuildTargetDisposable = cmakeApi.onBuildTargetChanged((target) => {
                    this.cmakeTarget = target;
                    vscode.commands.executeCommand<string>('cmake.buildDirectory')
                    .then(targetDir => {
                        this.cmakeBuildDirectory = targetDir || "";
                        getExecutablePath(this.cmakeBuildType, this.cmakeBuildDirectory, this.cmakeTarget)
                        .then(targetPath => {
                            if (targetPath !== null) {
                                this.cmakeLaunchTargetPath = targetPath || "";
                            }
                        });

                    });
                    
                });
                const configDoneDisposable = cmakeApi.onActiveProjectChanged((projectUri) => {
                    if (projectUri) {
                        cmakeApi.getProject(projectUri).then(this.updateProject);
                    }
                });

                cmakeApi.getProject(workspaceFolder.uri).then(this.updateProject);
                
                this._disposables.push(configBuildTargetDisposable);
                this._disposables.push(configDoneDisposable);
            });
        }
    }
    private updateProject(project: Project | undefined): void {
        if (project) {
            this.cmakeProject = project;
            this.cmakeSrcDirectory =  this.workspaceFolder.uri.fsPath || "";
            project.getActiveBuildType().then(buildType => {
                this.cmakeBuildType = buildType || "";
                this.activeWorkspace(this);
            });

        }
    }
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}