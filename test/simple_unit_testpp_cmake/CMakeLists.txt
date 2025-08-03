cmake_minimum_required(VERSION 3.16)
project(HelloWorldTest)

# Download and configure UnitTest++
include(FetchContent)
FetchContent_Declare(
    unittest-cpp
    GIT_REPOSITORY https://github.com/unittest-cpp/unittest-cpp.git
    GIT_TAG master
)
FetchContent_MakeAvailable(unittest-cpp)

# Create test executable
add_executable(hello_test test_main.cpp)
target_link_libraries(hello_test UnitTest++)