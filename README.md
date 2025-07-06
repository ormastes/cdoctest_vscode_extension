# C++ Doc Test for VS Code

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.97.0-brightgreen.svg)

A VS Code extension for running C++ documentation tests and executable tests with integrated test explorer support.

## Features

- **C++ Documentation Testing**: Run documentation tests using cdoctest
- **Executable Testing**: Support for C++ executable and binary tests
- **Test Explorer Integration**: View and run tests directly from VS Code's test explorer
- **CMake Integration**: Automatic test discovery for CMake projects
- **Debug Support**: Debug C++ tests with integrated debugger
- **Configurable Test Separators**: Customize test case naming conventions

## Installation

### Prerequisites

1. Install the cdoctest Python module:
```bash
python -m pip install --upgrade cdoctest
python -m clang_repl_kernel --install-default-toolchain
```

2. Required VS Code extensions:
   - CMake Tools (for CMake projects)
   - LLDB DAP (for debugging support)

### Extension Installation

Install from the VS Code marketplace by searching for "C++ Doc Test" or install directly from the `.vsix` file.

## Configuration

The extension provides extensive configuration options in VS Code settings:

### Basic Settings

- `cdoctest.pythonExePath`: Path to Python executable (required)
- `cdoctest.useCmakeTarget`: Use CMake targets for test discovery
- `cdoctest.srcDirectory`: Source directory for tests
- `cdoctest.buildDirectory`: Build directory for tests

### Test Execution Patterns

- `cdoctest.testRunArgPattern`: Arguments for running cdoctest tests
- `cdoctest.exe_testRunArgPattern`: Arguments for executable tests
- `cdoctest.bin_testRunArgPattern`: Arguments for binary tests

### Test Case Separators

- `cdoctest.testcaseSeparator`: Separator for cdoctest (default: "::")
- `cdoctest.exe_testcaseSeparator`: Separator for executable tests (default: "::")
- `cdoctest.bin_testcaseSeparator`: Separator for binary tests (default: "::")

## Usage

1. Open a C++ project in VS Code
2. Configure the extension settings (especially Python path)
3. Open the Test Explorer (Testing icon in sidebar)
4. Tests will be automatically discovered
5. Click on tests to run or debug them

### Test Controllers

The extension provides three test controllers:
- **cdoctest Test**: For documentation tests
- **Cpp Executable Test**: For executable tests
- **Binary Test**: For binary tests

## Development

### Building from Source

```bash
npm install
npm run compile
```

### Running Tests

```bash
npm test
npm run test:e2e
```

### Packaging

```bash
vsce package
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests on [GitHub](https://github.com/ormastes/cdoctest_vscode_extension).

## License

This project is licensed under the MIT License.

## Changelog

### Version 0.1.0
- Added BinConfig for binary test support
- Added configurable test case separators
- Fixed debug button functionality
- Added CMake API event listeners for better integration
- Improved test discovery and execution
- New icon design

### Version 0.0.2
- Initial release with basic cdoctest and executable test support