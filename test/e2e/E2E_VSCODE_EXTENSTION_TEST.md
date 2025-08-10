# VS Code Extension E2E Testing with Playwright

## Overview

We use **Playwright** for comprehensive end-to-end testing of our VS Code extension. Our test suite includes both build verification tests and VS Code UI automation tests to ensure the extension works correctly with CMake/CTest projects.

## Latest Updates (August 2025)

### Key Improvements
- **Test Panel Selection**: Use `[aria-label="Testing"]` selector for reliable test panel opening
- **Root Node Expansion**: Use `.monaco-tl-twistie` selector to expand test tree nodes
- **Extension Dependencies**: Don't use `--disable-extensions` flag as it prevents CMake Tools from loading
- **Single VSCode Instance**: Ensure only one VSCode instance runs during tests to avoid conflicts

## Key Features

1. **Build and Discovery Tests**: Verify CMake build process and test discovery
2. **CTest Integration**: Validate that tests work correctly with CTest
3. **Test Execution**: Verify individual and batch test execution
4. **XML Output Validation**: Check proper generation of test results
5. **VS Code UI Tests**: Automated testing of the extension within VS Code (Electron)

## Test Setup

### Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.3"
  }
}
```

### Configuration Structure

```
test/
├── unittest_ctest_sample/         # Test workspace for CTest integration
│   ├── CMakeLists.txt            # CMake configuration with UnitTest++
│   └── test_main.cpp             # UnitTest++ test cases
└── e2e/
    ├── playwright.config.ts       # Playwright configuration
    ├── specs/                     # Test specifications
    │   ├── build-and-discover.spec.ts  # Build and test discovery tests
    │   └── extension-load.spec.ts      # VS Code UI automation tests
    └── E2E_VSCODE_EXTENSTION_TEST.md   # This documentation
```

## Test Implementation

### Current Test Files

1. **extension-test-panel.spec.ts** - Main test for CMake rebuild with CTest
2. **cmake-clean-test.spec.ts** - Tests CMake clean operation
3. **cmake-rebuild-ctest.spec.ts** - Tests CMake rebuild and CTest verification
4. **simple-vscode-open.spec.ts** - Basic VSCode opening test

### Opening Test Panel (Improved Method)

```typescript
// Most reliable way to open the test panel
console.log('Opening Testing panel...');
const testPanelOpened = await helper.clickElement(mainWindow, '[aria-label="Testing"]', 3000);

if (!testPanelOpened) {
  // Fallback: Try command palette
  console.log('Opening Testing panel via command palette...');
  await mainWindow.keyboard.press('Control+Shift+P');
  await mainWindow.waitForTimeout(1000);
  await mainWindow.keyboard.type('View: Show Testing');
  await mainWindow.waitForTimeout(1000);
  await mainWindow.keyboard.press('Enter');
}
```

### Expanding Test Tree Nodes

```typescript
// Find and expand root test node
const rootNode = await mainWindow.locator('.monaco-list-row:has-text("calculator_test")').first();
if (rootNode) {
  await rootNode.click();
  await mainWindow.waitForTimeout(1000);
  
  // Click the expand arrow (twistie)
  const expandArrow = await mainWindow.locator('.monaco-tl-twistie').first();
  if (await expandArrow.isVisible()) {
    await expandArrow.click();
    console.log('Clicked expand arrow to show test list');
    await mainWindow.waitForTimeout(2000);
  }
}
```

### CTest Discovery Test (ctest-discovery.spec.ts)

```typescript
import { expect, test } from '@mshanemc/vscode-test-playwright';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

test('CDocTest discovers tests after CMake build', async ({ workbox, evaluateInVSCode }) => {
  const workspacePath = path.join(__dirname, '..', 'unittest_ctest_sample');
  const buildPath = path.join(workspacePath, 'build');
  
  // Step 1: Configure and build CMake project
  await execAsync(`cmake -S ${workspacePath} -B ${buildPath}`);
  await execAsync(`cmake --build ${buildPath}`);
  
  // Step 2: Wait for extension to discover tests
  await new Promise(resolve => setTimeout(resolve, 3000)); // Give time for discovery
  
  // Step 3: Open Testing sidebar
  await evaluateInVSCode(async (vscode) => {
    await vscode.commands.executeCommand('workbench.view.testing.focus');
  });
  
  // Step 4: Verify test items appear in Testing view
  const testingView = workbox.locator('.test-explorer-view');
  await expect(testingView).toBeVisible();
  
  // Look for our test suites
  const mathTests = testingView.locator('text=/MathTests/');
  const stringTests = testingView.locator('text=/StringTests/');
  
  await expect(mathTests).toBeVisible({ timeout: 10000 });
  await expect(stringTests).toBeVisible({ timeout: 10000 });
  
  // Verify individual test cases
  const additionTest = testingView.locator('text=/Addition/');
  const subtractionTest = testingView.locator('text=/Subtraction/');
  
  await expect(additionTest).toBeVisible();
  await expect(subtractionTest).toBeVisible();
});

test('CDocTest runs selected test and shows results', async ({ workbox, evaluateInVSCode }) => {
  // Open Testing sidebar
  await evaluateInVSCode(async (vscode) => {
    await vscode.commands.executeCommand('workbench.view.testing.focus');
  });
  
  const testingView = workbox.locator('.test-explorer-view');
  
  // Find and run the Addition test
  const additionTest = testingView.locator('text=/Addition/');
  await additionTest.hover();
  
  // Click the run button for this specific test
  const runButton = additionTest.locator('..').locator('[aria-label*="Run"]').first();
  await runButton.click();
  
  // Wait for test to complete and check for pass indicator
  await expect(additionTest.locator('..').locator('.codicon-testing-passed-icon')).toBeVisible({ timeout: 5000 });
});
```

## Running Tests

1. Install dependencies:
   ```bash
   npm install --save-dev @playwright/test @mshanemc/vscode-test-playwright
   npx playwright install
   ```

2. Build the extension:
   ```bash
   npm run compile
   ```

3. Run all tests:
   ```bash
   npx playwright test
   ```

4. Run specific test file:
   ```bash
   npx playwright test ctest-discovery.spec.ts
   ```

5. Run with UI mode for debugging:
   ```bash
   npx playwright test --ui
   ```

## Best Practices

1. **Extension Dependencies**: Allow VSCode to load necessary extensions (especially CMake Tools)
   - Don't use `--disable-extensions` flag
   - Install required extensions with `--install-extension=ms-vscode.cmake-tools`
2. **Wait Strategies**: Use appropriate timeouts for VSCode operations
   - Panel opening: 3000ms
   - Test discovery: 5000ms
   - Tree expansion: 2000ms
3. **Selector Reliability**: Use the most specific selectors
   - Test panel: `[aria-label="Testing"]`
   - Expand arrows: `.monaco-tl-twistie`
   - Test nodes: `.monaco-list-row:has-text("test_name")`
4. **Build Verification**: Always ensure CMake builds complete before test discovery
5. **Single Instance**: Ensure only one VSCode instance runs during tests

## VSCode Launch Configuration

```typescript
// Proper VSCode launch configuration for testing
const helper = new VSCodeTestHelper({
  workspacePath: workspacePath,
  buildPath: buildPath,
  additionalArgs: [
    '--extensionDevelopmentPath=' + extensionPath,
    // Don't use --disable-extensions as it prevents CMake Tools from loading
    '--install-extension=ms-vscode.cmake-tools',
    '--enable-proposed-api=' + extensionPath  // Enable proposed APIs if needed
  ],
  initTimeout: 10000
});
```

## Known Issues and Solutions

1. **CMake Tools Not Loading**: Don't use `--disable-extensions` flag
2. **Test Panel Not Opening**: Use `[aria-label="Testing"]` selector first
3. **Tests Not Visible**: Ensure root node is expanded with `.monaco-tl-twistie`
4. **Multiple VSCode Instances**: Track and close all instances properly

## Additional Resources

- [@mshanemc/vscode-test-playwright Documentation](https://www.npmjs.com/package/@mshanemc/vscode-test-playwright)
- [Playwright Documentation](https://playwright.dev/)
- [VS Code Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VS Code Test API](https://code.visualstudio.com/api/extension-guides/testing)