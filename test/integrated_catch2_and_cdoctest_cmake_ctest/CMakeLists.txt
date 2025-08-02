cmake_minimum_required(VERSION 3.10)
project(HelloWorldTest)

# Enable testing
enable_testing()
include(CTest)

include(../../cmake/util.cmake)

# Download and configure Catch2
include(FetchContent)
FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.4.0
)
FetchContent_MakeAvailable(Catch2)

# Create test executable
add_executable(hello_test test_main.cpp)
target_link_libraries(hello_test PRIVATE Catch2::Catch2WithMain)

# Discover tests with location
discover_tests_with_location(hello_test catch2)