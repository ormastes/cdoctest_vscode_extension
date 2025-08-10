cmake_minimum_required(VERSION 3.14)
project(SimpleGTestProject)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include FetchContent to download GoogleTest
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# Enable testing
enable_testing()

# Add the main library
add_library(calculator_lib
    src/calculator.cpp
)

# Add the main executable
add_executable(calculator_app
    src/main.cpp
)
target_link_libraries(calculator_app calculator_lib)

# Add test executable
add_executable(calculator_tests
    tests/test_calculator.cpp
)

target_link_libraries(calculator_tests
    calculator_lib
    GTest::gtest_main
)

# Include Google Test's CMake functions
include(GoogleTest)

# Discover tests for CTest
gtest_discover_tests(calculator_tests)

# Add a simple CTest
add_test(NAME SimpleCalculatorTest COMMAND calculator_tests)