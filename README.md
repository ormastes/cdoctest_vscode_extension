# cdoc_test_vscode_extension

A VSCode extension for running C++ tests with multiple test framework support including cdoctest, Google Test, UnitTest++, and Catch2.

## Features

- **Multiple Test Frameworks**: Support for cdoctest, executable tests, binary tests, and CMake/CTest integration
- **CTest Integration**: Automatically discovers and runs tests through CTest when CMake is configured
  - **Recursive Include Support**: Automatically follows `include()`, `subdirs()`, and `add_subdirectory()` commands in CTestTestfile.cmake files
- **Test Explorer Integration**: Full integration with VSCode's native Test Explorer
- **Debugging Support**: Debug tests with multiple debugger backends (LLDB, GDB, Visual Studio)
- **Configurable Test Types**: Enable/disable specific test configurations via settings

## Installation

### Prerequisites

Install cdoctest python modules:
```bash
python -m pip install --upgrade cdoctest
python -m clang_repl_kernel --install-default-toolchain
```
Note: Installing the toolchain may take a long time.

## Configuration

### Enabling/Disabling Test Configurations

You can control which test configurations are available through VSCode settings:

```json
{
  "cdoctest.enableCdoctestConfig": true,   // Enable cdoctest tests (default: true)
  "cdoctest.enableExeConfig": true,        // Enable executable tests (default: true)
  "cdoctest.enableBinConfig": true,        // Enable binary tests (default: true)
  "cdoctest.enableCmakeConfig": true       // Enable CMake/CTest tests (default: true)
}
```

### CMake/CTest Configuration

When using CMake projects, the extension can automatically discover tests through CTest:

```json
{
  "cdoctest.useCmakeTarget": true,         // Use CMake target for test discovery
  "cdoctest.useCTestDiscovery": true,      // Enable CTest test discovery
  "cdoctest.ctestUseExitCode": true        // Use exit codes for test results
}
```

### Debugging Configuration

The extension automatically selects the appropriate debugger based on your platform:
- **Windows**: Visual Studio debugger (`cppvsdbg`)
- **Linux**: GDB debugger (`cppdbg`)
- **macOS**: LLDB debugger (`lldb-dap`)

You can override the debugger type in your `launch.json` configuration.

## Recent Updates

### Version 0.7.0
- **Modernized CMake Tools Integration**: Removed outdated `vscode-cmake-tools` npm dependency
- Updated to use modern CMake Tools extension API through VSCode's native extension system
- Improved compatibility with latest CMake Tools extension versions
- Reduced dependency footprint for better maintainability

### Version 0.6.3
- Added support for recursive CTest file includes through `include()`, `subdirs()`, and `add_subdirectory()` commands
- Fixed test running spinner to properly stop when tests complete
- Improved CTest parser to handle nested test directory structures

### Version 0.5.0
- Added support for Visual Studio and GDB debuggers alongside LLDB
- Fixed invalid TestItem property assignments when using CTest
- Added settings to enable/disable individual test configurations
- Improved CTest data storage using WeakMap pattern
- Added launch.json existence check with console warnings

## Usage

1. Open a C++ project in VSCode
2. The extension will automatically discover tests based on your configuration
3. Use the Test Explorer sidebar to view and run tests
4. Click the debug icon next to a test to debug it
5. Configure which test types are enabled through VSCode settings

## Troubleshooting

If tests are not discovered:
1. Check that the appropriate test configuration is enabled in settings
2. For CMake projects, ensure CMake is properly configured
3. Check the output panel for any error messages
4. Verify that cdoctest is properly installed if using cdoctest features

## TODO
add clangd path Configuration.
