import { test, expect } from './setup';
import * as path from 'path';
import * as fs from 'fs';

test.describe('CMake Integration Tests', () => {
  test.beforeEach(async ({ page, workspacePath }) => {
    // Create build directory
    const buildDir = path.join(workspacePath, 'build');
    fs.mkdirSync(buildDir, { recursive: true });
    
    // Wait for VS Code and extensions to fully load
    await page.waitForTimeout(8000);
    
    // Configure CMake
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('CMake: Configure');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
  });

  test('should discover tests from CMake project', async ({ page, workspacePath }) => {
    // Open Testing view
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Refresh tests to trigger discovery
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Refresh Tests');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Check if tests are discovered
    const testItems = await page.locator('.testing-explorer-tree-element [aria-label*="TestSuite"]');
    await expect(testItems.first()).toBeVisible({ timeout: 20000 });
  });

  test('should run CMake tests', async ({ page, workspacePath }) => {
    // Open Testing view
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Run all tests
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Run All Tests');
    await page.keyboard.press('Enter');
    
    // Wait for test execution
    await page.waitForTimeout(8000);

    // Check test results - look for any test result icon
    const testResults = await page.locator('.testing-explorer-tree-element .codicon-testing-passed-icon, .testing-explorer-tree-element .codicon-testing-failed-icon');
    await expect(testResults.first()).toBeVisible({ timeout: 15000 });
  });

  test('should show test output in terminal', async ({ page, workspacePath }) => {
    // Run all tests
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Run All Tests');
    await page.keyboard.press('Enter');
    
    // Wait for test execution and terminal output
    await page.waitForTimeout(5000);

    // Open Output panel to see test results
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('View: Toggle Output');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Check if output panel is visible
    const outputPanel = await page.locator('.output-view-content, .monaco-editor[role="code"]');
    await expect(outputPanel.first()).toBeVisible({ timeout: 10000 });
  });
});