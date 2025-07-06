import { test, expect } from './setup';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Test Discovery', () => {
  test('should discover tests from C++ executable', async ({ page, workspacePath }) => {
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
    expect(testCount).toBeGreaterThan(0);
  });

  test('should discover tests using cdoctest python module', async ({ page, workspacePath }) => {
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
    await expect(testExplorer).toBeVisible();
  });
});