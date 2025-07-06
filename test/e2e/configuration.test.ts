import { test, expect } from './setup';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Configuration Management', () => {
  test('should load and apply cdoctest configuration', async ({ page, workspacePath }) => {
    // Create a .vscode directory with settings
    const vscodeDir = path.join(workspacePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    // Create settings.json
    const settings = {
      "cdoctest.pythonExePath": "/usr/bin/python3",
      "cdoctest.configName": "MyTestConfig",
      "cdoctest.useCmakeTarget": true,
      "cdoctest.buildDirectory": "${workspaceFolder}/build",
      "cdoctest.srcDirectory": "${workspaceFolder}/src",
      "cdoctest.testRunArgPattern": "custom_pattern ${test_full_name}",
      "cdoctest.resultSuccessRgex": "all_tests_passed=true"
    };

    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );

    // Reload window to apply settings
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Developer: Reload Window');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Verify settings are loaded
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Preferences: Open Settings (UI)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Search for cdoctest settings
    const searchBox = await page.locator('.settings-editor input[aria-label="Search settings"]');
    await searchBox.fill('cdoctest.configName');
    await page.waitForTimeout(1000);

    // Check if the value is set correctly
    const configNameInput = await page.locator('input[aria-label*="configName"]');
    const value = await configNameInput.inputValue();
    expect(value).toBe('MyTestConfig');
  });

  test('should handle multiple workspace configurations', async ({ page, workspacePath }) => {
    // Create multi-root workspace file
    const workspaceFile = path.join(workspacePath, 'multi-root.code-workspace');
    const workspace1 = path.join(workspacePath, 'project1');
    const workspace2 = path.join(workspacePath, 'project2');

    // Create project directories
    fs.mkdirSync(workspace1, { recursive: true });
    fs.mkdirSync(workspace2, { recursive: true });

    // Create workspace file
    const workspaceConfig = {
      folders: [
        { path: './project1' },
        { path: './project2' }
      ],
      settings: {
        "cdoctest.pythonExePath": "python3"
      }
    };

    fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

    // Create different settings for each project
    fs.mkdirSync(path.join(workspace1, '.vscode'), { recursive: true });
    fs.writeFileSync(
      path.join(workspace1, '.vscode', 'settings.json'),
      JSON.stringify({
        "cdoctest.configName": "Project1Config",
        "cdoctest.buildDirectory": "${workspaceFolder}/build1"
      }, null, 2)
    );

    fs.mkdirSync(path.join(workspace2, '.vscode'), { recursive: true });
    fs.writeFileSync(
      path.join(workspace2, '.vscode', 'settings.json'),
      JSON.stringify({
        "cdoctest.configName": "Project2Config",
        "cdoctest.buildDirectory": "${workspaceFolder}/build2"
      }, null, 2)
    );

    // Open the multi-root workspace
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('File: Open Workspace from File...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Type the workspace file path
    await page.keyboard.type(workspaceFile);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Verify both configurations are loaded
    const explorer = await page.locator('.explorer-folders-view');
    await expect(explorer).toBeVisible();
    
    // Check if both projects are visible
    const project1 = await page.locator('text=project1');
    const project2 = await page.locator('text=project2');
    
    await expect(project1).toBeVisible();
    await expect(project2).toBeVisible();
  });

  test('should validate configuration values', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Preferences: Open Settings (JSON)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Try to set invalid configuration
    const editor = await page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`{
  "cdoctest.pythonExePath": "",
  "cdoctest.testRunArgPattern": "",
  "cdoctest.resultSuccessRgex": "["
}`);

    // Save and check for validation errors
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);

    // Look for error decorations or messages
    const problems = await page.locator('.monaco-editor .squiggly-error');
    const problemCount = await problems.count();
    expect(problemCount).toBeGreaterThan(0);
  });
});