# Google Test with CTest Integration

This example demonstrates how to use Google Test with CMake's CTest, automatically discovering tests with file and line information.

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

1. The CMakeLists.txt uses `discover_tests_with_location(hello_test gtest)`
2. During build, the test executable is run with `--gtest_output=xml` to generate XML output
3. The XML is parsed to extract test names, and CTest configuration is generated
4. Each test is registered with file and line properties for IDE integration

## Generated Files

- `build/hello_test_discover.xml` - Google Test XML output
- `build/CTestTestfile.cmake` - Generated CTest configuration with test properties