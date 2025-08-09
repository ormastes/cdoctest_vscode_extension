#include <iostream>

// Test to verify configuration enable/disable functionality
// This test should only be discovered when the appropriate config is enabled

namespace ConfigEnableTest {
    void test_config_is_enabled() {
        std::cout << "Configuration is enabled - test discovered successfully" << std::endl;
    }
    
    void test_debugger_selection() {
        #ifdef _WIN32
            std::cout << "Windows platform - should use Visual Studio debugger" << std::endl;
        #elif __linux__
            std::cout << "Linux platform - should use GDB debugger" << std::endl;
        #elif __APPLE__
            std::cout << "macOS platform - should use LLDB debugger" << std::endl;
        #else
            std::cout << "Unknown platform - using default debugger" << std::endl;
        #endif
    }
}

int main() {
    std::cout << "Running configuration enable tests..." << std::endl;
    ConfigEnableTest::test_config_is_enabled();
    ConfigEnableTest::test_debugger_selection();
    std::cout << "All tests passed!" << std::endl;
    return 0;
}