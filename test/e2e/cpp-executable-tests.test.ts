import { test, expect } from './setup';
import * as path from 'path';
import * as fs from 'fs';

test.describe('C++ Executable Test Discovery', () => {
  test.beforeEach(async ({ workspacePath }) => {
    // Create a more comprehensive C++ test project
    const srcDir = path.join(workspacePath, 'src');
    const testDir = path.join(workspacePath, 'test');
    
    fs.mkdirSync(testDir, { recursive: true });

    // Create test executable source
    fs.writeFileSync(path.join(testDir, 'test_main.cpp'), `
#include <iostream>
#include <string>
#include <vector>

// Simple test framework
class TestResult {
public:
    std::string name;
    bool passed;
    std::string message;
};

std::vector<TestResult> results;

void TEST_CASE(const std::string& name, bool condition, const std::string& message = "") {
    results.push_back({name, condition, message});
}

int main(int argc, char* argv[]) {
    // Run different tests based on arguments
    if (argc > 1) {
        std::string testName = argv[1];
        
        if (testName == "TestMath::Addition") {
            TEST_CASE("TestMath::Addition", 2 + 2 == 4);
        } else if (testName == "TestMath::Subtraction") {
            TEST_CASE("TestMath::Subtraction", 10 - 5 == 5);
        } else if (testName == "TestString::Concatenation") {
            TEST_CASE("TestString::Concatenation", std::string("Hello ") + "World" == "Hello World");
        } else if (testName == "TestString::Length") {
            TEST_CASE("TestString::Length", std::string("Test").length() == 4);
        }
    } else {
        // List all tests when no argument provided
        std::cout << "TestMath::Addition" << std::endl;
        std::cout << "TestMath::Subtraction" << std::endl;
        std::cout << "TestString::Concatenation" << std::endl;
        std::cout << "TestString::Length" << std::endl;
        return 0;
    }
    
    // Output results
    for (const auto& result : results) {
        if (result.passed) {
            std::cout << "[PASS] " << result.name << std::endl;
            return 0;
        } else {
            std::cout << "[FAIL] " << result.name;
            if (!result.message.empty()) {
                std::cout << ": " << result.message;
            }
            std::cout << std::endl;
            return 1;
        }
    }
    
    return 0;
}
`);

    // Update CMakeLists.txt for test executable
    fs.writeFileSync(path.join(workspacePath, 'CMakeLists.txt'), `
cmake_minimum_required(VERSION 3.16)
project(TestProject)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Main executable
add_executable(main_app src/main.cpp)

# Test executable
add_executable(test_runner test/test_main.cpp)

# Enable testing
enable_testing()

# Add individual tests
add_test(NAME TestMath::Addition COMMAND test_runner TestMath::Addition)
add_test(NAME TestMath::Subtraction COMMAND test_runner TestMath::Subtraction)
add_test(NAME TestString::Concatenation COMMAND test_runner TestString::Concatenation)
add_test(NAME TestString::Length COMMAND test_runner TestString::Length)
`);

    // Create .vscode/settings.json
    const vscodeDir = path.join(workspacePath, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify({
      "cmake.buildDirectory": "${workspaceFolder}/build",
      "cdoctest.testExecutables": ["test_runner"],
      "cdoctest.buildCommand": "cmake --build ${workspaceFolder}/build",
      "cdoctest.testDiscoveryMode": "automatic"
    }, null, 2));
  });

  test('should discover C++ executable tests', async ({ page, workspacePath }) => {
    await page.waitForTimeout(7000); // Extra time for CMake configuration

    // Open Testing view
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Check test discovery
    const mathTests = await page.locator('[aria-label*="TestMath"]');
    await expect(mathTests).toHaveCount(2, { timeout: 15000 });
    
    const stringTests = await page.locator('[aria-label*="TestString"]');
    await expect(stringTests).toHaveCount(2, { timeout: 15000 });
  });

  test('should run individual C++ tests', async ({ page, workspacePath }) => {
    await page.waitForTimeout(7000);

    // Open Testing view
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Run a specific test
    const additionTest = await page.locator('[aria-label*="TestMath::Addition"]').first();
    await additionTest.hover();
    
    const runButton = await additionTest.locator('a[title*="Run Test"]');
    await runButton.click();
    
    await page.waitForTimeout(5000);

    // Check test passed
    const passedIcon = await page.locator('[aria-label*="TestMath::Addition"] .codicon-testing-passed-icon');
    await expect(passedIcon).toBeVisible({ timeout: 10000 });
  });

  test('should show test output for C++ tests', async ({ page, workspacePath }) => {
    await page.waitForTimeout(7000);

    // Run test and check output
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Test: Run All Tests');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Open Output panel
    await page.keyboard.press('Control+Shift+U');
    await page.waitForTimeout(1000);

    // Check for test output
    const outputPanel = await page.locator('.output-view-content');
    const outputText = await outputPanel.textContent();
    
    expect(outputText).toContain('[PASS]');
    expect(outputText).toContain('TestMath::Addition');
  });

  test('should handle test failures', async ({ page, workspacePath }) => {
    // Modify test to fail
    const testFile = path.join(workspacePath, 'test', 'test_main.cpp');
    const content = fs.readFileSync(testFile, 'utf8');
    fs.writeFileSync(testFile, content.replace('2 + 2 == 4', '2 + 2 == 5'));

    await page.waitForTimeout(7000);

    // Run the failing test
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);
    await page.keyboard.type('Testing: Focus on Test Explorer View');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const additionTest = await page.locator('[aria-label*="TestMath::Addition"]').first();
    await additionTest.hover();
    
    const runButton = await additionTest.locator('a[title*="Run Test"]');
    await runButton.click();
    
    await page.waitForTimeout(5000);

    // Check test failed
    const failedIcon = await page.locator('[aria-label*="TestMath::Addition"] .codicon-testing-failed-icon');
    await expect(failedIcon).toBeVisible({ timeout: 10000 });
  });
});