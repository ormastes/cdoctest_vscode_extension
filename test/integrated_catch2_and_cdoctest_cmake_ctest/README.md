# Catch2 with CTest Integration

This example demonstrates how to use Catch2 v3 with CMake's CTest, automatically discovering tests with file and line information.

## Building

```bash
mkdir build
cd build
cmake ..
cmake --build .
```

## Running Tests

```bash
# List all discovered tests
ctest -N

# Run all tests
ctest

# Run specific test
ctest -R "MathTests.Addition"
```

## How it Works

1. The CMakeLists.txt uses `discover_tests_with_location(hello_test catch2)`
2. During build, the test executable is run with `--reporter xml` to generate XML output
3. The XML is parsed to extract test names and locations (file and line)
4. Each test is registered with CTest with properties for IDE integration

## Generated Files

- `build/hello_test_discover.xml` - Catch2 XML output with test results
- `build/CTestTestfile.cmake` - Generated CTest configuration with test properties

## Test Organization

Catch2 tests are organized using TEST_CASE macros. The test names follow a pattern
similar to Google Test for consistency: `SuiteName.TestName`