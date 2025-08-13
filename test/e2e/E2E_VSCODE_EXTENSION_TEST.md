# VS Code Extension E2E Testing with vscode-extension-tester and Cucumber

## Overview

This E2E test suite uses **Cucumber** with **vscode-extension-tester** to perform behavior-driven testing of the cdoctest VSCode extension. The tests automate VSCode UI interactions and verify extension functionality.

## Project Structure

```
test/e2e/
├── features/                    # Cucumber feature files (BDD scenarios)
│   └── extension-loading.feature
├── steps/                       # Step definitions
│   └── extension-loading.steps.ts
├── support/                     # Test setup and world
│   └── world.ts
├── lib/                         # Utility libraries
│   └── status-manager.ts        # VSCode process management
├── cucumber.mjs                 # Cucumber configuration
├── tsconfig.json               # TypeScript configuration
└── E2E_VSCODE_EXTENSION_TEST.md   # This documentation
```

## Key Components

### 1. **status-manager.ts** (Process Lifecycle Management)

The `StatusManager` class provides comprehensive VSCode process management:

- **PID Tracking**: Monitors VSCode processes before, during, and after tests
- **Setup & Launch**: Handles VSCode download, extension installation, and launch
- **Cleanup Verification**: Ensures all VSCode processes are properly closed
- **Process Detection**: Identifies VSCode processes across platforms

Key methods:
- `setupVSCode()`: Downloads VSCode, installs extension and dependencies
- `launchVSCode()`: Starts VSCode with tests and tracks new PIDs
- `closeVSCode()`: Closes VSCode and verifies process termination
- `cleanup()`: Final cleanup with PID verification

### 2. **world.ts** (Cucumber World)

Integrates StatusManager with Cucumber hooks:
- `BeforeAll`: Sets up VSCode and extension
- `Before`: Launches VSCode for each test
- `After`: Closes VSCode and verifies cleanup
- `AfterAll`: Final cleanup and PID verification

### 3. **Feature Files**

Located in `test/e2e/features/`, these files define test scenarios in Gherkin syntax:

```gherkin
Feature: VSCode Extension Loading
  Scenario: Extension loads successfully in VSCode
    When I open the workspace "test/integrated_unit_gtest_and_cdoctest_cmake_ctest"
    Then the cdoctest extension should be loaded
    And the Testing view should be available
    
  Scenario: Run StringTests Concatenation and verify result
    Given the test result file "test_concatenation_result.txt" does not exist
    When I run the test "StringTests::Concatenation"
    Then the test should pass with a success message
    And the file "test_concatenation_result.txt" should exist in the build directory
```

### 4. **Step Definitions**

Located in `test/e2e/steps/`, these implement the Gherkin steps using vscode-extension-tester API.

## Test Workspace

The tests use the CMake workspace at:
`test/integrated_unit_gtest_and_cdoctest_cmake_ctest`

This workspace contains:
- CMakeLists.txt with GTest and cdoctest configuration
- test_main.cpp with sample tests (MathTests, StringTests)
- Pre-built binaries for test discovery

## Dependencies

```json
{
  "devDependencies": {
    "@cucumber/cucumber": "^10.9.0",
    "@cucumber/pretty-formatter": "^1.0.0",
    "vscode-extension-tester": "^8.10.0",
    "ps-list": "^9.1.0",
    "chai": "^5.2.1",
    "@types/chai": "^4.3.5"
  }
}
```

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Build the extension
npm run compile
```

### Run Cucumber Tests
```bash
# Run all Cucumber tests
npm run test:cucumber

# Run with specific features
npx cucumber-js test/e2e/features/extension-loading.feature
```

## Process Management Features

The StatusManager ensures robust process management:

1. **Baseline PID Capture**: Records existing VSCode processes before tests
2. **Launch Monitoring**: Tracks new PIDs when VSCode starts
3. **Cleanup Verification**: Confirms all test VSCode processes terminate
4. **Leak Detection**: Warns if any VSCode processes remain after tests

Example output:
```
Baseline: 0 VS Code processes already running
VSCode launched with 5 new processes: 12345, 12346, 12347, 12348, 12349
VSCode closed successfully
Final cleanup complete
```

## Configuration

### Cucumber Configuration (cucumber.mjs)
- Feature paths: `test/e2e/features/**/*.feature`
- Step definitions: `out/test/e2e/steps/**/*.js`
- Support files: `out/test/e2e/support/**/*.js`
- Output formats: progress-bar, HTML, JSON

### VSCode Settings
The StatusManager applies these default settings:
- Disables welcome screen and auto-updates
- Enables all cdoctest configurations
- Configures CMake integration

## Troubleshooting

### VSCode doesn't close properly
- Check the PID list in console output
- StatusManager will report which PIDs are still running
- May need to manually terminate orphaned processes

### Extension not loading
- Verify extension dependencies are installed (CMake Tools)
- Check extension activation events in package.json
- Review VSCode output/console for activation errors

### Test discovery fails
- Ensure CMake build directory exists
- Verify test workspace has been built
- Check cdoctest Python module is available

## Best Practices

1. **Always use StatusManager** for VSCode lifecycle management
2. **Monitor PID outputs** to detect process leaks
3. **Keep features focused** - one scenario per specific functionality
4. **Use descriptive step definitions** for maintainability
5. **Clean up resources** in After/AfterAll hooks

## Extension Features Tested

- ✅ Extension loads on startup
- ✅ Testing view appears in activity bar
- ✅ Extension dependencies load (CMake Tools, LLDB DAP)
- ✅ Test discovery from CMake projects
- ✅ Test tree shows correct test structure
- ✅ Test execution (StringTests::Concatenation)
- ✅ Test result verification (GUI success message)
- ✅ File creation verification (test output file)

## Future Enhancements

- Add scenarios for test execution
- Test debugging capabilities
- Verify test result reporting
- Test configuration changes
- Add performance benchmarks