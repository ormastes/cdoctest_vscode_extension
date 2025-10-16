
import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

// CMake Tools API interfaces
// Based on the ms-vscode.cmake-tools extension API
interface CMakeToolsApi {
    getVersion(): { major: number; minor: number };
    getProject(workspaceUri: vscode.Uri): Promise<Project | undefined>;
    onActiveProjectChanged: vscode.Event<vscode.Uri | undefined>;
    onBuildTargetChanged: vscode.Event<string>;
}

interface Project {
    getActiveBuildType(): Promise<string | undefined>;
}

enum Version {
    v1 = 1,
    v2 = 2
}

// Function to get CMake Tools API from the extension
async function getCMakeToolsApi(version: Version): Promise<CMakeToolsApi | undefined> {
    const cmakeExtension = vscode.extensions.getExtension<CMakeToolsApi>('ms-vscode.cmake-tools');
    if (!cmakeExtension) {
        return undefined;
    }

    if (!cmakeExtension.isActive) {
        await cmakeExtension.activate();
    }

    return cmakeExtension.exports;
}

interface Artifact {
    path: string;
}
interface Dependency {
    id: string;
    backtrace: number;
}

interface TargetReply {
    nameOnDisk?: string;
    artifacts?: Artifact[];
    dependencies?: Dependency[];
}

async function getCmakeApiJsonFile(buildType: string, buildDir: string, targetName: string) {
    const pattern = path.posix.join(buildDir, '.cmake/api/v1/reply', `target-${targetName}-*`);


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

    return reply;
}

async function _getDllDependencies(
    buildType: string,
    buildDir: string,
    targetName: string,
    visited: Set<string> = new Set(),
    dependencies: string[] = []
): Promise<string[]> {

    // Prevent infinite recursion by checking if the target has already been processed.
    if (visited.has(targetName)) {
        return dependencies;
    }
    visited.add(targetName);

    // Fetch the JSON data for the current target.
    const reply = await getCmakeApiJsonFile(buildType, buildDir, targetName);

    if (!reply) {
        return dependencies;
    }
    if (!reply.artifacts || reply.artifacts.length === 0) {
        console.warn(`No artifacts found in ${reply}`);
        return dependencies;
    }

    const path = await _getDllExecutablePath('.dll', reply, buildType, buildDir, targetName);
    if (path) {
        dependencies.push(path);
    }

    if (reply.dependencies && Array.isArray(reply.dependencies)) {
        for (const dep of reply.dependencies) {
            // Split the dependency id at "::"
            const parts = dep.id.split('::');
            if (parts.length > 1) {
                const newId = parts[0];

                // Recursively retrieve dependencies for this modified dependency id.
                return _getDllDependencies(buildType, buildDir, newId, visited, dependencies);
            }
        }
    }

    return dependencies;
}

export async function getDllDependencies(
    buildType: string,
    buildDir: string,
    targetName: string,
    visited: Set<string> = new Set(),
    dependencies: string[] = []
): Promise<string[]> {
    const normalizedBuildDir = buildDir.replace(/\\/g, '/');
    return _getDllDependencies(buildType, normalizedBuildDir, targetName, visited, dependencies);
}

async function _getDllExecutablePath(findExt: string, reply: TargetReply, buildType: string, buildDir: string, targetName: string): Promise<string | undefined> {

    if (!reply) {
        return undefined;
    }
    if (!reply.artifacts || reply.artifacts.length === 0) {
        console.warn(`No artifacts found in ${reply}`);
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
            artifact.path.replace(/\\/g, '/').toLowerCase().endsWith(findExt)
        )?.path;
    }

    // append normalizedBuildDir if execPath is relative
    if (execPath && !path.isAbsolute(execPath)) {
        execPath = path.posix.join(buildDir, execPath);
    }

    // Normalize the final path to use forward slashes.
    return execPath ? execPath.replace(/\\/g, '/') : undefined;
}

export async function getExecutablePath(buildType: string, buildDir: string, targetName: string): Promise<string | undefined> {
    // Use posix-style paths (i.e. forward slashes) and replace any backslashes in buildDir
    const normalizedBuildDir = buildDir.replace(/\\/g, '/');
    const reply = await getCmakeApiJsonFile(buildType, normalizedBuildDir, targetName);
    if (!reply) {
        return undefined;
    }
    return _getDllExecutablePath('.exe', reply, buildType, normalizedBuildDir, targetName);
}

// config enum for Config | ExeConfig | BinConfig | CMakeConfig 0: Config, 1: ExeConfig, 2: BinConfig, 3: CMakeConfig
export enum ConfigType {
    Config = 0,
    ExeConfig = 1,
    BinConfig = 2,
    CMakeConfig = 3
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
    public type: ConfigType;
    public controllerId: string;
    public useCmakeTarget: boolean;
    public _pythonExePath: string;
    public cdoctest_min_version: string = '1.1.0';

    public _testRunArgPattern: string;
    public _listTestArgPattern: string;
    public _exe_testRunArgPattern: string;
    public _exe_listTestArgPattern: string;
    public _bin_testRunArgPattern: string;
    public _bin_listTestArgPattern: string;
    public _resultFile: string;
    public _exe_resultFile: string;
    public _bin_resultFile: string;
    public _resultSuccessRgex: string;

    public _srcDirectory: string;
    public _buildDirectory: string;
    public _executable: string;
    public _exe_executable: string;
    public _bin_executable: string;

    public _testRunUseFile: boolean;
    public _listTestUseFile: boolean;
    public exe_testRunUseFile: boolean;
    public exe_listTestUseFile: boolean;
    public bin_testRunUseFile: boolean;
    public bin_listTestUseFile: boolean;
    public libPaths: string;
    public configName: string;
    public testcaseSeparator: string;
    public exe_testcaseSeparator: string;
    public bin_testcaseSeparator: string;
    public useCTestDiscovery: boolean;
    public ctestUseExitCode: boolean;

    private _disposables: vscode.Disposable[] = [];

    public cmakeProject: Project | undefined;
    private cmakeTarget: string = "";
    protected cmakeSrcDirectory: string = "";
    protected cmakeBuildDirectory: string = "";
    private cmakeLaunchTargetPath: string = "";
    public cmakeBuildType: string = "";

    private skipWords: string[] = [];

    private cmakeApi: CMakeToolsApi | undefined;

    private activeWorkspace!: (config: Config | ExeConfig | BinConfig | CMakeConfig) => void | undefined;

    protected covert_file_path(file: string, skipWord: string): string {
        this.skipWords.push(skipWord);
        file = this.convert(file, {});
        this.skipWords.pop();
        if (process.platform === 'win32') {
            return file.replaceAll('/', '\\');
        }
        return file.replaceAll('\\', '/');
    }

    // key should have ${test_full_name} and ${test_suite_name} and ${test_case_name}
    protected convert(text: string, additionalEnv: { [key: string]: string }): string {
        let dic_applied_text = text;
        for (const key in additionalEnv) {
            dic_applied_text = dic_applied_text.replace('${' + key + '}', additionalEnv[key]);
        }
        let result = dic_applied_text;
        for (let i = 0; i < 4; i++) {
            if (!this.skipWords.includes("buildDirectory")) { result = result.replace('${buildDirectory}', this.buildDirectory); }
            if (!this.skipWords.includes("srcDirectory")) { result = result.replace('${srcDirectory}', this.srcDirectory); }
            result = result.replace('${workspaceFolder}', this.workspaceFolder.uri.fsPath);
            if (this.useCmakeTarget) {
                result = result.replace('${cmakeTarget}', this.cmakeTarget);
            }
            if (!this.skipWords.includes("pythonExePath")) { result = result.replace('${pythonExePath}', this._pythonExePath); }
            if (result.indexOf('${') === -1) {
                break;
            }
        }
        return result;
    }
    public _get_testrun_executable_args(executable: string, testSeparator: string, additionalEnv: { [key: string]: string }): string[] {
        additionalEnv['test_full_name'] = additionalEnv['test_suite_name'] + testSeparator + additionalEnv['test_case_name'];
        let result = this.convert(executable, additionalEnv);
        return result.split(' ');
    }

    public get_exe_testrun_executable_args(additionalEnv: { [key: string]: string }): string[] | undefined {
        if (this.exe_executable === "") { return undefined; }
        return this._get_testrun_executable_args(this.exe_executable + ' ' + this._exe_testRunArgPattern, this.exe_testcaseSeparator, additionalEnv);
    }
    public get_bin_testrun_executable_args(additionalEnv: { [key: string]: string }): string[] | undefined {
        if (this.bin_executable === "") { return undefined; }
        return this._get_testrun_executable_args(this.bin_executable + ' ' + this._bin_testRunArgPattern, this.bin_testcaseSeparator, additionalEnv);
    }
    public get_testrun_executable_args(additionalEnv: { [key: string]: string }): string[] | undefined {
        if (this.executable === "") { return undefined; }
        return this._get_testrun_executable_args(this.executable + ' ' + this._testRunArgPattern, this.testcaseSeparator, additionalEnv);
    }
    public get pythonExePath(): string {
        return this.covert_file_path(this._pythonExePath, "pythonExePath");
    }
    public get exe_testrun_list_args(): string[] | undefined {
        if (this.exe_executable === "") { return undefined; }
        return this.convert(this.exe_executable + ' ' + this._exe_listTestArgPattern, {}).split(' ');
    }
    public get bin_testrun_list_args(): string[] | undefined {
        if (this.bin_executable === "") { return undefined; }
        return this.convert(this.bin_executable + ' ' + this._bin_listTestArgPattern, {}).split(' ');
    }
    public get testrun_list_args(): string[] | undefined {
        if (this.executable === "") { return undefined; }
        return this.convert(this._listTestArgPattern, {}).split(' ');
    }
    public get resultFile(): string {
        return this.covert_file_path(this._resultFile, "resultFile");
    }
    public get exe_resultFile(): string {
        return this.covert_file_path(this._exe_resultFile, "exe_resultFile");
    }
    public get bin_resultFile(): string {
        return this.covert_file_path(this._bin_resultFile, "bin_resultFile");
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
    public get bin_executable(): string {
        return this.covert_file_path(this._bin_executable, "bin_executable");
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
            return this.covert_file_path(this.cmakeLaunchTargetPath, "executable");
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
    public get testRunUseFile(): boolean {
        return this._testRunUseFile;
    }
    public get listTestUseFile(): boolean {
        return this._listTestUseFile;
    }
    public activateWorkspaceBaseOnCmakeSetting():void {
        if (!this.useCmakeTarget) {
            this.activeWorkspace(this);
        } else {
            getCMakeToolsApi(Version.v2).then(cmakeApi => {
                if (!cmakeApi) {
                    vscode.window.showErrorMessage('CMake Tools API is unavailable. Please install CMake Tools.', 'OK');
                    return;
                }
                this.cmakeApi = cmakeApi;


                const configBuildTargetDisposable = cmakeApi.onBuildTargetChanged((target) => {
                    this.cmakeTarget = target;
                    vscode.commands.executeCommand<string>('cmake.buildDirectory')
                        .then(targetDir => {
                            this.cmakeBuildDirectory = targetDir;
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

                cmakeApi.getProject(this.workspaceFolder.uri).then(this.updateProject);

                this._disposables.push(configBuildTargetDisposable);
                this._disposables.push(configDoneDisposable);
            });
        }
    }

    constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, activeWorkspace: (config: Config|ExeConfig|BinConfig|CMakeConfig) => void, isActivateWorkspace:boolean = true) {
        this.type = ConfigType.Config;
        this.workspaceFolder = workspaceFolder;
        this.controllerId = "cdoctest";
        this.useCmakeTarget = vscode.workspace.getConfiguration('cdoctest').get('useCmakeTarget') as boolean;
        this._pythonExePath = vscode.workspace.getConfiguration('cdoctest').get('pythonExePath') as string;
        this._testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('testRunArgPattern') as string;
        this._listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('listTestArgPattern') as string;
        this._exe_testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_testRunArgPattern') as string;
        this._exe_listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_listTestArgPattern') as string;
        this._bin_testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('bin_testRunArgPattern') as string;
        this._bin_listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('bin_listTestArgPattern') as string;
        this._resultFile = vscode.workspace.getConfiguration('cdoctest').get('resultFile') as string;
        this._exe_resultFile = vscode.workspace.getConfiguration('cdoctest').get('exe_resultFile') as string;
        this._bin_resultFile = vscode.workspace.getConfiguration('cdoctest').get('bin_resultFile') as string;
        this._resultSuccessRgex = vscode.workspace.getConfiguration('cdoctest').get('resultSuccessRgex') as string;

        this._srcDirectory = vscode.workspace.getConfiguration('cdoctest').get('srcDirectory') as string;
        this._buildDirectory = vscode.workspace.getConfiguration('cdoctest').get('buildDirectory') as string;
        this._executable = vscode.workspace.getConfiguration('cdoctest').get('executable') as string;
        this._exe_executable = vscode.workspace.getConfiguration('cdoctest').get('exe_executable') as string;
        this._bin_executable = vscode.workspace.getConfiguration('cdoctest').get('bin_executable') as string;

        this._testRunUseFile = vscode.workspace.getConfiguration('cdoctest').get('testRunUseFile') as boolean;
        this._listTestUseFile = vscode.workspace.getConfiguration('cdoctest').get('listTestUseFile') as boolean;
        this.exe_testRunUseFile = vscode.workspace.getConfiguration('cdoctest').get('exe_testRunUseFile') as boolean;
        this.exe_listTestUseFile = vscode.workspace.getConfiguration('cdoctest').get('exe_listTestUseFile') as boolean;
        this.bin_testRunUseFile = vscode.workspace.getConfiguration('cdoctest').get('bin_testRunUseFile') as boolean;
        this.bin_listTestUseFile = vscode.workspace.getConfiguration('cdoctest').get('bin_listTestUseFile') as boolean;
        this.libPaths = vscode.workspace.getConfiguration('cdoctest').get('libPaths') as string;
        this.configName = vscode.workspace.getConfiguration('cdoctest').get('configName') as string;
        this.testcaseSeparator = vscode.workspace.getConfiguration('cdoctest').get('testcaseSeparator') as string;
        this.exe_testcaseSeparator = vscode.workspace.getConfiguration('cdoctest').get('exe_testcaseSeparator') as string;
        this.bin_testcaseSeparator = vscode.workspace.getConfiguration('cdoctest').get('bin_testcaseSeparator') as string;
        this.useCTestDiscovery = vscode.workspace.getConfiguration('cdoctest').get('useCTestDiscovery') as boolean;
        this.ctestUseExitCode = vscode.workspace.getConfiguration('cdoctest').get('ctestUseExitCode') as boolean;

        this.updateProject = this.updateProject.bind(this);

        if (this._pythonExePath === '') {
            console.error('cdoctest: pythonExePath must be set');
        }
        this.activeWorkspace = activeWorkspace;

        if (this.useCmakeTarget) {
            // assert _srcDirectory and _buildDirectory are empty
            if (this._srcDirectory !== '' || this._buildDirectory !== '') {
                console.error('cdoctest: srcDirectory and buildDirectory must be empty when useCmakeTarget is true');
            }
            // assert _executable and _exe_executable are empty
            if (this._executable !== '' || this._exe_executable !== '') {
                console.error('cdoctest: executable and exe_executable must be empty when useCmakeTarget is true');
            }
        } else {
            // assert _srcDirectory and _buildDirectory are not empty
            if (this._srcDirectory === '' || this._buildDirectory === '') {
                console.error('cdoctest: srcDirectory and buildDirectory must be set when useCmakeTarget is false');
            }
            // assert _executable and _exe_executable are not empty
            if (this._executable === '' && this._exe_executable === '') {
                console.error('cdoctest: executable or exe_executable must be set when useCmakeTarget is false');
            }
        }
        if (isActivateWorkspace) {
            this.activateWorkspaceBaseOnCmakeSetting();
        }

    }
    private updateProject(project: Project | undefined): void {
        if (project) {
            this.cmakeProject = project;
            this.cmakeSrcDirectory = this.workspaceFolder.uri.fsPath || "";
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

// extend Config class to ExeConfig
export class ExeConfig extends Config {
    constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, activeWorkspace: (config: Config | ExeConfig | BinConfig | CMakeConfig) => void) {
        super(context, workspaceFolder, activeWorkspace, false);
        this.type = ConfigType.ExeConfig;
        this.controllerId = "exe_test";
        this.activateWorkspaceBaseOnCmakeSetting();
    }
    public get testRunUseFile(): boolean {
        return this.exe_testRunUseFile;
    }
    public get listTestUseFile(): boolean {
        return this.exe_listTestUseFile;
    }
    public get testRunArgPattern(): string {
        return this._exe_testRunArgPattern;
    }
    public get listTestArgPattern(): string {
        return this._exe_listTestArgPattern;
    }
    public get resultFile(): string {
        return this._exe_resultFile;
    }
    public get executable(): string {
        return this._exe_executable;
    }
    public get srcDirectory(): string {
        return this._srcDirectory;
    }
    public get buildDirectory(): string {
        if (this.useCmakeTarget) {
            return this.covert_file_path(this.cmakeBuildDirectory, "buildDirectory");
        }
        return this.covert_file_path(this._buildDirectory, "buildDirectory");
    }
    public get testrun_list_args(): string[] | undefined {
        return this.exe_testrun_list_args;
    }

}

// extend Config class to BinConfig
export class BinConfig extends Config {
    constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, activeWorkspace: (config: Config | ExeConfig | BinConfig | CMakeConfig) => void) {
        super(context, workspaceFolder, activeWorkspace, false);
        this.type = ConfigType.BinConfig;
        this.controllerId = "bin_test";
        this.activateWorkspaceBaseOnCmakeSetting();
    }
    public get testRunUseFile(): boolean {
        return this.bin_testRunUseFile;
    }
    public get listTestUseFile(): boolean {
        return this.bin_listTestUseFile;
    }
    public get testRunArgPattern(): string {
        return this._bin_testRunArgPattern;
    }
    public get listTestArgPattern(): string {
        return this._bin_listTestArgPattern;
    }
    public get resultFile(): string {
        return this._bin_resultFile;
    }
    public get executable(): string {
        return this._bin_executable;
    }
    public get srcDirectory(): string {
        return this._srcDirectory;
    }
    public get buildDirectory(): string {
        if (this.useCmakeTarget) {
            return this.covert_file_path(this.cmakeBuildDirectory, "buildDirectory");
        }
        return this.covert_file_path(this._buildDirectory, "buildDirectory");
    }
    public get testrun_list_args(): string[] | undefined {
        return this.bin_testrun_list_args;
    }
}

// CMakeConfig class for CMake-specific configuration
export class CMakeConfig extends Config {
    public cmakeCommand: string;
    public cmakeGenerator: string;

    public cmakeConfigureArgs: string;
    public cmakeBuildArgs: string;


    constructor(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, activeWorkspace: (config: Config | ExeConfig | BinConfig | CMakeConfig) => void) {
        super(context, workspaceFolder, activeWorkspace, false);
        this.type = ConfigType.CMakeConfig;
        this.controllerId = "cmake_test";
        
        // Read CMake-specific configuration
        this.cmakeCommand = vscode.workspace.getConfiguration('cdoctest').get('cmakeCommand') as string || 'cmake';
        this.cmakeGenerator = vscode.workspace.getConfiguration('cdoctest').get('cmakeGenerator') as string || '';
        this.cmakeConfigureArgs = vscode.workspace.getConfiguration('cdoctest').get('cmakeConfigureArgs') as string || '';
        this.cmakeBuildArgs = vscode.workspace.getConfiguration('cdoctest').get('cmakeBuildArgs') as string || '';
        
        
        this.activateWorkspaceBaseOnCmakeSetting();
    }
    
    // Get full cmake configure command
    public getCMakeConfigureCommand(): string[] {
        const args = [this.cmakeCommand, '-S', this.cmakeSrcDirectory, '-B', this.cmakeBuildDirectory];
        
        if (this.cmakeGenerator) {
            args.push('-G', this.cmakeGenerator);
        }
        
        if (this.cmakeBuildType) {
            args.push('-DCMAKE_BUILD_TYPE=' + this.cmakeBuildType);
        }
        
        if (this.cmakeConfigureArgs) {
            args.push(...this.cmakeConfigureArgs.split(' ').filter(arg => arg.length > 0));
        }
        
        return args;
    }
    
    // Get full cmake build command
    public getCMakeBuildCommand(): string[] {
        const args = [this.cmakeCommand, '--build', this.cmakeBuildDirectory];
        
        if (this.cmakeBuildType) {
            args.push('--config', this.cmakeBuildType);
        }
        
        if (this.cmakeBuildArgs) {
            args.push(...this.cmakeBuildArgs.split(' ').filter(arg => arg.length > 0));
        }
        
        return args;
    }
}