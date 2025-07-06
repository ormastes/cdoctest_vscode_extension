"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = void 0;
const test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
const path = __importStar(require("path"));
const vscode_test_helper_1 = require("./helpers/vscode-test-helper");
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
exports.test = test_1.test.extend({
    extensionPath: async ({}, use) => {
        const extensionPath = path.resolve(__dirname, '../..');
        await use(extensionPath);
    },
    workspacePath: async ({}, use) => {
        // Create a temporary workspace directory for testing
        const tempDir = path.join(__dirname, 'temp-workspace');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // Create a sample project structure
        const srcDir = path.join(tempDir, 'src');
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }
        // Create a simple CMakeLists.txt
        fs.writeFileSync(path.join(tempDir, 'CMakeLists.txt'), `
cmake_minimum_required(VERSION 3.10)
project(TestProject)

set(CMAKE_CXX_STANDARD 17)

add_executable(test_executable src/main.cpp src/test.cpp)

enable_testing()
add_test(NAME TestSuite::TestCase COMMAND test_executable)
`);
        // Create sample source files
        fs.writeFileSync(path.join(srcDir, 'main.cpp'), `
#include <iostream>

int main() {
    std::cout << "Test executable" << std::endl;
    return 0;
}
`);
        fs.writeFileSync(path.join(srcDir, 'test.cpp'), `
#include <iostream>

void test_function() {
    std::cout << "Test function executed" << std::endl;
}
`);
        await use(tempDir);
        // Cleanup after test
        fs.rmSync(tempDir, { recursive: true, force: true });
    },
    vscodeApp: async ({ extensionPath, workspacePath }, use) => {
        const helper = new vscode_test_helper_1.VSCodeTestHelper();
        // Download VS Code if needed
        const vscodeExecutablePath = await helper.downloadVSCode();
        // Launch VS Code with Electron
        const electronApp = await playwright_1._electron.launch({
            executablePath: vscodeExecutablePath,
            args: [
                '--extensionDevelopmentPath=' + extensionPath,
                '--disable-extensions',
                '--new-window',
                workspacePath
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });
        await use(electronApp);
        await electronApp.close();
    },
    page: async ({ vscodeApp }, use) => {
        const page = await vscodeApp.firstWindow();
        // Wait for VS Code to fully load
        await page.waitForTimeout(3000);
        await use(page);
    },
});
//# sourceMappingURL=setup.js.map