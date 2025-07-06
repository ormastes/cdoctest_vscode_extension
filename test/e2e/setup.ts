import { test as base, expect } from '@playwright/test';
import * as path from 'path';
import { VSCodeTestHelper } from './helpers/vscode-test-helper';
import { _electron as electron } from 'playwright';
import * as fs from 'fs';

export interface ExtensionFixtures {
  extensionPath: string;
  workspacePath: string;
  vscodeApp: any;
  page: any;
}

export const test = base.extend<ExtensionFixtures>({
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
    const helper = new VSCodeTestHelper();
    
    // Download VS Code if needed
    const vscodeExecutablePath = await helper.downloadVSCode();
    
    // Extensions will be loaded from the user's VS Code installation
    // No need to install them separately
    
    // Launch VS Code with Electron
    const electronApp = await electron.launch({
      executablePath: vscodeExecutablePath,
      args: [
        '--extensionDevelopmentPath=' + extensionPath,
        // DO NOT disable any extensions - we need them all for testing
        '--new-window',
        '--disable-workspace-trust',
        workspacePath
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Disable telemetry for tests
        'VSCODE_TELEMETRY_OFF': 'true'
      },
      timeout: 60000 // Give more time to launch
    });

    await use(electronApp);
    await electronApp.close();
  },

  page: async ({ vscodeApp }, use) => {
    const page = await vscodeApp.firstWindow();
    
    // Wait for VS Code to fully load
    await page.waitForTimeout(10000);
    
    // Ensure the workbench is visible
    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
    
    await use(page);
  },
});

export { expect };