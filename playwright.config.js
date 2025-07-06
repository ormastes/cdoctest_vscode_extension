"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    testDir: './test/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'playwright-results.xml' }],
        ['list']
    ],
    use: {
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    timeout: 60000,
    projects: [
        {
            name: 'vscode-extension',
            use: {
                ...test_1.devices['Desktop Electron'],
            },
        },
    ],
    outputDir: 'test-results/',
});
//# sourceMappingURL=playwright.config.js.map