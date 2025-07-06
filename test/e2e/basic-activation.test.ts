import { test, expect } from './setup';

test.describe('Basic Extension Activation', () => {
  test('should load VS Code with extension', async ({ page }) => {
    // Wait for VS Code to fully load
    await page.waitForTimeout(10000);
    
    // Check if VS Code loaded successfully
    const workbench = await page.locator('.monaco-workbench');
    await expect(workbench).toBeVisible({ timeout: 30000 });
  });

  test('should have extension installed', async ({ page }) => {
    await page.waitForTimeout(8000);
    
    // Open Extensions view
    await page.keyboard.press('Control+Shift+X');
    await page.waitForTimeout(3000);
    
    // Search for our extension
    const searchBox = await page.locator('.extensions-viewlet input[placeholder*="Search"]');
    await searchBox.fill('cdoctest');
    await page.waitForTimeout(2000);
    
    // Check if extension is visible in the list
    const extensionItem = await page.locator('.extension-list-item').filter({ hasText: 'cdoctest' });
    await expect(extensionItem.first()).toBeVisible({ timeout: 10000 });
  });

  test('should register test controllers', async ({ page }) => {
    await page.waitForTimeout(8000);
    
    // Open Testing view
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(1000);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    
    // Check if testing view is visible
    const testingView = await page.locator('.testing-view-pane, .test-explorer-panel, [id="workbench.view.extension.test"]');
    await expect(testingView.first()).toBeVisible({ timeout: 15000 });
  });
});