"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./setup");
setup_1.test.describe('Extension Activation', () => {
    (0, setup_1.test)('should activate the extension when VS Code starts', async ({ page }) => {
        // Wait for VS Code to fully load
        await page.waitForTimeout(2000);
        // Check if the extension is activated by looking for test controllers
        // Open the Testing view
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Testing: Focus on Test Explorer View');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        // Check if our test controllers are registered
        const testingView = await page.locator('.testing-view-pane');
        await (0, setup_1.expect)(testingView).toBeVisible({ timeout: 10000 });
        // The extension should register two test controllers
        const testControllers = await page.locator('[aria-label*="test"]');
        await (0, setup_1.expect)(testControllers).toHaveCount(2, { timeout: 10000 });
    });
    (0, setup_1.test)('should register cdoctest configuration settings', async ({ page }) => {
        // Open settings
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Preferences: Open Settings (JSON)');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        // Close the settings editor and open the UI settings
        await page.keyboard.press('Control+W');
        await page.waitForTimeout(500);
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        await page.keyboard.type('Preferences: Open Settings (UI)');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        // Search for cdoctest settings
        const searchBox = await page.locator('.settings-editor input[aria-label="Search settings"]');
        await searchBox.fill('cdoctest');
        await page.waitForTimeout(1000);
        // Check if settings are visible
        const settings = await page.locator('.setting-item');
        const count = await settings.count();
        (0, setup_1.expect)(count).toBeGreaterThan(0);
    });
    (0, setup_1.test)('should display extension commands in command palette', async ({ page }) => {
        // Open command palette
        await page.keyboard.press('Control+Shift+P');
        await page.waitForTimeout(500);
        // Search for test-related commands
        await page.keyboard.type('test');
        await page.waitForTimeout(500);
        // Check if test commands are available
        const commands = await page.locator('.quick-input-list .monaco-list-row');
        const commandCount = await commands.count();
        (0, setup_1.expect)(commandCount).toBeGreaterThan(0);
        // Close command palette
        await page.keyboard.press('Escape');
    });
});
//# sourceMappingURL=extension.activation.test.js.map