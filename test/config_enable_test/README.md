# Configuration Enable/Disable Test

This test verifies that the configuration enable/disable functionality works correctly.

## Test Setup

The `.vscode/settings.json` file in this directory is configured to:
- Disable cdoctest configuration
- Enable executable test configuration  
- Disable binary test configuration
- Disable CMake test configuration

## Expected Behavior

When opening this folder in VSCode with the cdoctest extension:
1. Only the "Cpp Executable Test" controller should appear in the Test Explorer
2. The other test controllers should not be visible
3. The test should run successfully and output platform-specific debugger information

## Running the Test

1. Compile the test: `g++ -o test_config_enable test_config_enable.cpp`
2. Open this folder in VSCode
3. Check that only the executable test configuration is available
4. Run the test from the Test Explorer
5. Verify the output shows the correct platform and debugger type