
import * as vscode from 'vscode';
import { CMakeToolsApi, getCMakeToolsApi, Project, Version } from 'vscode-cmake-tools';

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

    private _disposables: vscode.Disposable[] = [];

    public cmakeProject : Project | undefined;
    private cmakeTarget : string = "";
    private cmakeSrcDirectory : string = "";
    private cmakeBuildDirectory : string = "";
    private cmakeLaunchTargetPath : string = "";

    private skipWords: string[] = [];

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

	constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, ativeWorkspace: (config: Config) => void) {
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

        if (this._pythonExePath === '') {
            throw new Error('cdoctest: pythonExePath must be set');
        }

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
            ativeWorkspace(this);
        } else {
            getCMakeToolsApi(Version.v2, /*exactMatch*/ false).then(cmakeApi => {
                if (!cmakeApi) {
                    vscode.window.showErrorMessage('CMake Tools API is unavailable. Please install CMake Tools.');
                    return;
                }
                cmakeApi.getProject(workspaceFolder.uri).then(project => {
                    this.cmakeProject = project;
                });
                const configBuildTargetDisposable = cmakeApi.onBuildTargetChanged((target) => {
                    this.cmakeTarget = target;
                    this.cmakeBuildDirectory = "";
                    this.cmakeSrcDirectory = "";
                    this.cmakeLaunchTargetPath = "";
                    vscode.commands.executeCommand<string>('cmake.buildDirectory')
                    .then(targetDir => {
                        this.cmakeBuildDirectory = targetDir || "";

                    });
                    vscode.commands.executeCommand<string>('cmake.getLaunchTargetPath')
                    .then(targetPath => {
                        this.cmakeLaunchTargetPath = targetPath || "";
                    });
                    vscode.commands.executeCommand<string>('cmake.sourceDir')
                    .then(srcDir => {
                        this.cmakeSrcDirectory = srcDir || "";
                    });
                });
                const configDoneDisposable = cmakeApi.onActiveProjectChanged((projectUri) => {
                    if (projectUri) {
                        vscode.window.showInformationMessage('CMake configuration is complete!');
                        ativeWorkspace(this);
                    }
                });
                this._disposables.push(configBuildTargetDisposable);
                this._disposables.push(configDoneDisposable);
            });
        }
    }
    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}