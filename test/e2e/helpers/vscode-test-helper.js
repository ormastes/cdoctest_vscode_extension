"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeTestHelper = void 0;
const test_electron_1 = require("@vscode/test-electron");
const child_process_1 = require("child_process");
class VSCodeTestHelper {
    vscodeExecutablePath;
    async downloadVSCode(version = 'stable') {
        this.vscodeExecutablePath = await (0, test_electron_1.downloadAndUnzipVSCode)(version);
        return this.vscodeExecutablePath;
    }
    async runTests(options) {
        const extensionDevelopmentPath = options.extensionDevelopmentPath;
        const extensionTestsPath = options.extensionTestsPath;
        const vscodeExecutablePath = options.vscodeExecutablePath || this.vscodeExecutablePath;
        if (!vscodeExecutablePath) {
            throw new Error('VS Code executable path not found. Please download VS Code first.');
        }
        await (0, test_electron_1.runTests)({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: options.launchArgs || ['--disable-extensions'],
        });
    }
    async launchVSCode(workspacePath, extensionPath) {
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
            const vscodeProcess = (0, child_process_1.spawn)(vscodeExecutablePath, args, {
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
exports.VSCodeTestHelper = VSCodeTestHelper;
//# sourceMappingURL=vscode-test-helper.js.map