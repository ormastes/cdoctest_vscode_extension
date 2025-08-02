cmake_minimum_required(VERSION 3.10)
project(HelloWorldTest)

# Enable testing
enable_testing()
include(CTest)

include(../../cmake/util.cmake)

# Download and configure Google Test
include(FetchContent)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG release-1.12.1
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# Create test executable
add_executable(hello_test test_main.cpp)
target_link_libraries(hello_test gtest_main gtest)

# Discover tests with location
discover_tests_with_location(hello_test gtest)