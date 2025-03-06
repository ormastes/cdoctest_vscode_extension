cmake_minimum_required(VERSION 3.10)
project(HelloWorldTest)
set(BUILD_SHARED_LIBS ON)

# Download and configure UnitTest++
include(FetchContent)
FetchContent_Declare(
    unittest-cpp
    GIT_REPOSITORY https://github.com/unittest-cpp/unittest-cpp.git
    GIT_TAG master
)
FetchContent_MakeAvailable(unittest-cpp)

#############################################
# copy unitest_CMakeLists.txt to build/_deps/unittest-cpp-src/CMakeLists.txt during configuration

add_library(hello_test_lib SHARED test_main.cpp)
target_link_libraries(hello_test_lib UnitTest++)

# Create test executable
add_executable(hello_test entry.cpp)
target_link_libraries(hello_test hello_test_lib)