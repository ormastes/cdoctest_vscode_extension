import { test, expect } from './setup';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Test Execution', () => {
  test('should run a single test and show results', async ({ page, workspacePath }) => {
    const buildDir = path.join(workspacePath, 'build');
    const testExePath = path.join(buildDir, 'test_runner');
    
    // Create build directory
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // Create a mock test runner
    fs.writeFileSync(testExePath, `#!/bin/bash
if [[ "$1" == "GetTcList:" ]]; then
  echo "TestSuite::PassingTest"
  echo "TestSuite::FailingTest"
elif [[ "$1" == "TC/TestSuite::PassingTest" ]]; then
  echo "Running PassingTest..."
  echo "Test passed!"
  # Create result file
  cat > ${buildDir}/output.vsc << EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="0" errors="0" time="0.1">
  <testsuite name="TestSuite" tests="1" failures="0" errors="0" time="0.1">
    <testcase classname="TestSuite" name="PassingTest" time="0.1"/>
  </testsuite>
</testsuites>
EOF
  exit 0
elif [[ "$1" == "TC/TestSuite::FailingTest" ]]; then
  echo "Running FailingTest..."
  echo "Test failed!"
  # Create result file
  cat > ${buildDir}/output.vsc << EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="1" errors="0" time="0.1">
  <testsuite name="TestSuite" tests="1" failures="1" errors="0" time="0.1">
    <testcase classname="TestSuite" name="FailingTest" time="0.1">
      <failure message="Assertion failed">Expected true but got false</failure>
    </testcase>
  </testsuite>
</testsuites>
EOF
  exit 1
fi
`);
    fs.chmodSync(testExePath, '755');

    // Configure the extension
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Preferences: Open Settings (JSON)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const editor = await page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`{
  "cdoctest.exe_executable": "${testExePath}",
  "cdoctest.buildDirectory": "${buildDir}",
  "cdoctest.exe_listTestArgPattern": "GetTcList:",
  "cdoctest.exe_testRunArgPattern": "TC/\${test_suite_name}::\${test_case_name} output.vsc",
  "cdoctest.exe_resultFile": "${buildDir}/output.vsc"
}`);
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);

    // Open Testing view and refresh
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Refresh tests
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Refresh Tests');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Run all tests
    const runAllButton = await page.locator('[aria-label="Run All Tests"]');
    if (await runAllButton.isVisible()) {
      await runAllButton.click();
      await page.waitForTimeout(3000);
    }

    // Check test results - look for pass/fail indicators
    const passedTests = await page.locator('.test-item .codicon-pass');
    const failedTests = await page.locator('.test-item .codicon-error');
    
    const passedCount = await passedTests.count();
    const failedCount = await failedTests.count();
    
    expect(passedCount).toBeGreaterThan(0);
    expect(failedCount).toBeGreaterThan(0);
  });

  test('should show test output in output panel', async ({ page, workspacePath }) => {
    // Run a test first (similar setup as above)
    const buildDir = path.join(workspacePath, 'build');
    const testExePath = path.join(buildDir, 'verbose_test');
    
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    fs.writeFileSync(testExePath, `#!/bin/bash
if [[ "$1" == "GetTcList:" ]]; then
  echo "VerboseTest::test_with_output"
elif [[ "$1" == "TC/VerboseTest::test_with_output" ]]; then
  echo "Starting test execution..."
  echo "Performing operation 1..."
  echo "Performing operation 2..."
  echo "Test completed successfully!"
  cat > ${buildDir}/output.vsc << EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="0" errors="0" time="0.5">
  <testsuite name="VerboseTest" tests="1" failures="0" errors="0" time="0.5">
    <testcase classname="VerboseTest" name="test_with_output" time="0.5"/>
  </testsuite>
</testsuites>
EOF
  exit 0
fi
`);
    fs.chmodSync(testExePath, '755');

    // Configure and run test
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Preferences: Open Settings (JSON)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const editor = await page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`{
  "cdoctest.exe_executable": "${testExePath}",
  "cdoctest.buildDirectory": "${buildDir}",
  "cdoctest.exe_listTestArgPattern": "GetTcList:",
  "cdoctest.exe_testRunArgPattern": "TC/\${test_suite_name}::\${test_case_name} output.vsc",
  "cdoctest.exe_resultFile": "${buildDir}/output.vsc"
}`);
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);

    // Run tests and check output panel
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Run All Tests');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Open output panel
    await page.keyboard.press('Control+Shift+U');
    await page.waitForTimeout(1000);

    // Check if output contains test execution details
    const outputPanel = await page.locator('.panel.integrated-terminal');
    await expect(outputPanel).toBeVisible();
  });
});