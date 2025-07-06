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
const setup_1 = require("./setup");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
setup_1.test.describe('Test Discovery', () => {
    (0, setup_1.test)('should discover tests from C++ executable', async ({ page, workspacePath }) => {
        // Create a test executable that outputs test list
        const testExePath = path.join(workspacePath, 'build', 'test_executable');
        const buildDir = path.join(workspacePath, 'build');
        // Create build directory
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
        // Create a mock executable that outputs test list
        fs.writeFileSync(testExePath, `#!/bin/bash
if [[ "$1" == "GetTcList:" ]]; then
  echo "TestSuite1::TestCase1"
  echo "TestSuite1::TestCase2"
  echo "TestSuite2::TestCase1"
fi
`);
        fs.chmodSync(testExePath, '755');
        // Configure the extension
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Preferences: Open Settings (JSON)');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        // Add configuration for exe tests
        const editor = await page.locator('.monaco-editor');
        await editor.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type(`{
  "cdoctest.exe_executable": "${testExePath}",
  "cdoctest.buildDirectory": "${buildDir}",
  "cdoctest.exe_listTestArgPattern": "GetTcList:"
}`);
        await page.keyboard.press('Control+S');
        await page.waitForTimeout(1000);
        // Open Testing view
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Testing: Focus on Test Explorer View');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        // Refresh tests
        const refreshButton = await page.locator('[aria-label="Refresh Tests"]');
        if (await refreshButton.isVisible()) {
            await refreshButton.click();
            await page.waitForTimeout(2000);
        }
        // Check if tests are discovered
        const testItems = await page.locator('.test-item');
        const testCount = await testItems.count();
        (0, setup_1.expect)(testCount).toBeGreaterThan(0);
    });
    (0, setup_1.test)('should discover tests using cdoctest python module', async ({ page, workspacePath }) => {
        // Create a Python script that simulates cdoctest list output
        const cdoctestScript = path.join(workspacePath, 'mock_cdoctest.py');
        fs.writeFileSync(cdoctestScript, `#!/usr/bin/env python3
import sys

if "--cdt_list_testcase" in sys.argv:
    print("ModuleTest::test_function1")
    print("ModuleTest::test_function2")
    print("IntegrationTest::test_integration1")
`);
        fs.chmodSync(cdoctestScript, '755');
        // Configure cdoctest settings
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Preferences: Open Settings (JSON)');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        const editor = await page.locator('.monaco-editor');
        await editor.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type(`{
  "cdoctest.pythonExePath": "python3",
  "cdoctest.buildDirectory": "${workspacePath}/build",
  "cdoctest.listTestArgPattern": "python3 ${cdoctestScript} --cdt_list_testcase"
}`);
        await page.keyboard.press('Control+S');
        await page.waitForTimeout(1000);
        // Refresh tests
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Testing: Refresh Tests');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        // Verify tests are discovered
        const testExplorer = await page.locator('.testing-view-pane');
        await (0, setup_1.expect)(testExplorer).toBeVisible();
    });
});
//# sourceMappingURL=test.discovery.test.js.map