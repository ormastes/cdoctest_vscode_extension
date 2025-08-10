# VS Code Extension E2E Testing with Playwright

## Overview

We use **Playwright** for comprehensive end-to-end testing of our VS Code extension. Our test suite includes both build verification tests and VS Code UI automation tests to ensure the extension works correctly with CMake/CTest projects.

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

### Extension Loading Test (extension-load.spec.ts)

```typescript
import { expect, test } from '@mshanemc/vscode-test-playwright';

test('CDocTest extension loads successfully', async ({ workbox, evaluateInVSCode }) => {
  // Verify extension is loaded and active
  const extensions = await evaluateInVSCode(async (vscode) => {
    return vscode.extensions.all.map(ext => ({
      id: ext.id,
      isActive: ext.isActive
    }));
  });
  
  const cdoctestExt = extensions.find(ext => 
    ext.id.includes('cdoctest')
  );
  
  expect(cdoctestExt).toBeDefined();
  expect(cdoctestExt?.isActive).toBe(true);
  
  // Verify Testing sidebar is available
  const activityBar = workbox.locator('.activitybar');
  const testingIcon = activityBar.locator('[aria-label*="Testing"]');
  await expect(testingIcon).toBeVisible();
});
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

1. **Isolation**: Test with minimal extensions to avoid conflicts
2. **Wait Strategies**: Use Playwright's built-in wait mechanisms and timeouts
3. **Dual Testing**: Combine UI assertions with VS Code API calls
4. **Build Verification**: Always ensure CMake builds complete before test discovery
5. **Workspace Setup**: Use the unittest_ctest_sample as a controlled test environment

## Playwright Configuration (playwright.config.ts)

```typescript
import { defineConfig } from '@playwright/test';
import type { VSCodeTestOptions, VSCodeWorkerOptions } from '@mshanemc/vscode-test-playwright';
import path from 'path';

export default defineConfig<VSCodeTestOptions, VSCodeWorkerOptions>({
  testDir: path.join(__dirname, 'specs'),
  workers: 1,
  timeout: 60000,
  use: {
    extensionDevelopmentPath: path.join(__dirname, '..', '..'),
    vscodeTrace: 'on',
    workspacePath: path.join(__dirname, 'unittest_ctest_sample'),
  },
  projects: [
    { name: 'stable' },
  ],
});
```

## Additional Resources

- [@mshanemc/vscode-test-playwright Documentation](https://www.npmjs.com/package/@mshanemc/vscode-test-playwright)
- [Playwright Documentation](https://playwright.dev/)
- [VS Code Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VS Code Test API](https://code.visualstudio.com/api/extension-guides/testing)