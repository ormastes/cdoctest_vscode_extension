
import * as vscode from 'vscode';

// --test ${test_suite_name}::${test_case_name} 
// workspaceFolder
// ${buildDirectory} --cdt_cmake_target=%{target} ${test_full_name}
export class Config {
    public useCmakeTarget: boolean;
    public _pythonExePath: string;

	public _testRunArgPattern: string;
	public _listTestArgPattern: string;
    public _exe_testRunArgPattern: string;
    public _exe_listTestArgPattern: string;
    public _resultFile: string;
    public _resultSuccessRgex: string;

    public _srcDirectory: string;
    public _buildDirectory: string;
    public _executable: string;
    public _exe_executable: string;

    public testRunUseFile: boolean;
    public listTestUseFile: boolean;
    public exe_testRunUseFile: boolean;
    public exe_listTestUseFile: boolean;

	constructor() {
        this.useCmakeTarget = vscode.workspace.getConfiguration('cdoctest').get('useCmakeTarget') as boolean;
        this._pythonExePath = vscode.workspace.getConfiguration('cdoctest').get('pythonExePath') as string;
		this._testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('testRunArgPattern') as string;
		this._listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('listTestArgPattern') as string;
        this._exe_testRunArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_testRunArgPattern') as string;
		this._exe_listTestArgPattern = vscode.workspace.getConfiguration('cdoctest').get('exe_listTestArgPattern') as string;
        this._resultFile = vscode.workspace.getConfiguration('cdoctest').get('resultFile') as string;
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
    }
}