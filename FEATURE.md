# CTest File Discovery Feature

## Overview
This feature adds support for discovering tests from CTest files generated during CMake builds. Instead of running executables to discover tests, the extension will read CTest configuration files directly, supporting multi-configuration generators (Debug/Release).

## Implementation Status
✅ **Completed** - The feature has been fully implemented with the following components:

## Key Components

### 1. CTest File Parser (`src/tclist_parser/ctestParser.ts`)
✅ Implemented:
- Parse CTest files from build directories
- Support multi-configuration generators (check Debug/Release subdirectories)
- Extract test information including:
  - Test name
  - Executable path
  - Test arguments
  - Optional properties: TEST_FILE, TEST_LINE, TEST_FULL_NAME, WORKING_DIRECTORY, TEST_FRAMEWORK

### 2. Configuration Extension
✅ Implemented:
- Added `cdoctest.useCTestDiscovery` configuration option (boolean, default: true)
- Added `cdoctest.ctestUseExitCode` configuration option (boolean, default: true)
- Automatically detects when CMake is used via `useCmakeTarget` setting
- Falls back to executable discovery if CTest parsing fails

### 3. Test Discovery Integration
✅ Implemented in `src/controller/controller.ts`:
- Modified `refreshHandler` to check if CTest discovery is enabled
- Uses CTest parser when both `useCTestDiscovery` and `useCmakeTarget` are true
- Maps CTest data to VS Code test items with proper hierarchy
- Stores CTest data for use during test execution

### 4. File Watcher
✅ Implemented:
- Watches for CTest file changes in build directory
- Automatically refreshes test list when CTest files are updated
- Supports watching multiple paths for multi-config builds

### 5. Test Execution
✅ Implemented:
- Uses stored CTest data during test execution
- Executes tests with exact command line from CTest configuration
- Respects WORKING_DIRECTORY property from CTest
- Supports exit code-based result determination (when `ctestUseExitCode` is true)
- Falls back to result file parsing when exit code support is disabled

## Implementation Details

### CTest File Format
CTest files contain test definitions like:
```cmake
add_test("MathTests::Subtraction" "C:/path/to/test.exe" "TC/MathTests::Subtraction")
set_tests_properties("MathTests::Subtraction" PROPERTIES
  WORKING_DIRECTORY "C:/path/to/build"
  TEST_FILE "C:/path/to/test_main.cpp"
  TEST_LINE "13"
  TEST_FULL_NAME "MathTests::Subtraction"
  TEST_FRAMEWORK "gtest"  # Can be: gtest, unittestpp, catch2, etc.
)
```

### File Locations
- Single configuration: `<buildDir>/CTestTestfile.cmake`
- Multi configuration: 
  - `<buildDir>/Debug/CTestTestfile.cmake`
  - `<buildDir>/Release/CTestTestfile.cmake`
  - etc.

### Data Flow
1. Build completes → CTest files generated/updated
2. File watcher detects changes
3. Parser reads CTest files
4. Test items created/updated in VS Code
5. Test explorer shows updated test list

## Benefits
- Faster test discovery (no executable runs needed)
- Works with multi-configuration generators
- Preserves exact test commands from CMake
- Supports custom test properties
- Automatic refresh when build completes and CTest files are updated
- Test framework identification (gtest, unittestpp, catch2) via TEST_FRAMEWORK property
- Framework-specific tags in VS Code test explorer
- Exit code-based test result determination (no result file needed for simple pass/fail)

## Usage
1. Ensure CMake is configured with `cdoctest.useCmakeTarget: true`
2. CTest discovery is enabled by default (`cdoctest.useCTestDiscovery: true`)
3. Exit code support is enabled by default (`cdoctest.ctestUseExitCode: true`)
4. Build your CMake project to generate CTest files
5. The extension will automatically discover tests from CTest files
6. Tests will refresh automatically when CTest files are updated

### Exit Code Support
When `cdoctest.ctestUseExitCode` is enabled (default):
- Test passes if the process exits with code 0
- Test fails if the process exits with any non-zero code
- No result file is required for basic pass/fail determination
- Result files are still used if available for detailed output

To disable exit code support and rely only on result files:
```json
"cdoctest.ctestUseExitCode": false
```

### Test Framework Support
When generating CTest files from CMake, add the TEST_FRAMEWORK property to identify the testing framework:

```cmake
# For Google Test
set_tests_properties(${test_name} PROPERTIES TEST_FRAMEWORK "gtest")

# For UnitTest++
set_tests_properties(${test_name} PROPERTIES TEST_FRAMEWORK "unittestpp")

# For Catch2
set_tests_properties(${test_name} PROPERTIES TEST_FRAMEWORK "catch2")
```

This allows the extension to:
- Display framework-specific tags in the test explorer
- Handle framework-specific result parsing (future enhancement)
- Apply framework-specific test execution strategies

### CMake Integration
The provided `cmake/util.cmake` file automatically adds the TEST_FRAMEWORK property when discovering tests:

```cmake
# Include the utility functions
include(path/to/util.cmake)

# For Google Test
add_executable(my_tests test_main.cpp)
target_link_libraries(my_tests GTest::gtest_main)
discover_tests_with_location(my_tests gtest)  # Automatically adds TEST_FRAMEWORK "gtest"

# For UnitTest++
discover_tests_with_location(my_tests unittest-cpp)  # Automatically adds TEST_FRAMEWORK "unittestpp"

# For Catch2
discover_tests_with_location(my_tests catch2)  # Automatically adds TEST_FRAMEWORK "catch2"
```

The utility function automatically generates CTest entries with the correct framework property.