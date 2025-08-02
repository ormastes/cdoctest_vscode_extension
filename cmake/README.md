# CMake Test Discovery Utility

The `util.cmake` file provides a unified function `discover_tests_with_location()` that automatically discovers tests from various C++ testing frameworks and generates CTest configuration with file and line information.

## Supported Frameworks

1. **UnitTest++** - Parses text output from custom `GetTcList:` command
2. **Google Test** - Parses XML output from `--gtest_output=xml`
3. **Catch2 v3** - Parses XML output from `--reporter xml`

## Usage

```cmake
include(util.cmake)

# For UnitTest++
discover_tests_with_location(my_test_target unittest-cpp)

# For Google Test
discover_tests_with_location(my_test_target gtest)

# For Catch2
discover_tests_with_location(my_test_target catch2)
```

## Features

- **Automatic test discovery** during build process
- **File and line information** stored as CTest properties
- **IDE integration** - test runners can navigate to test source locations
- **Consistent test naming** across all frameworks
- **Non-intrusive** - doesn't require modifying test code

## Generated Properties

Each discovered test has the following CTest properties:
- `TEST_FILE` - Absolute path to the test source file
- `TEST_LINE` - Line number where the test is defined
- `TEST_FULL_NAME` - Full test name (e.g., "SuiteName.TestName")
- `WORKING_DIRECTORY` - Build directory for test execution

## Implementation Details

### UnitTest++
- Requires custom main function that supports `GetTcList:` argument
- Outputs: `TestSuite::TestName,filename,linenumber`
- No test execution during discovery

### Google Test
- Runs tests with `--gtest_output=xml` to generate XML
- Parses `<testcase>` elements for test information
- Tests are executed during discovery (may fail)

### Catch2
- Runs tests with `--reporter xml` to generate XML
- Parses `<TestCase>` elements for test information
- Tests are executed during discovery (may fail)

## Files Generated

- `${TEST_TARGET}_discover.txt` or `.xml` - Raw output from test framework
- `${TEST_TARGET}_discover.cmake` - Generated discovery script
- `CTestTestfile.cmake` - CTest configuration with all discovered tests