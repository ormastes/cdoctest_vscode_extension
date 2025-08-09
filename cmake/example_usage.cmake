# Example CMakeLists.txt showing how to use discover_tests_with_location
# with automatic TEST_FRAMEWORK property generation

cmake_minimum_required(VERSION 3.14)
project(MyTestProject)

# Include the utility functions
include(util.cmake)

# Example 1: Google Test
find_package(GTest REQUIRED)
add_executable(my_gtest_tests test_main.cpp)
target_link_libraries(my_gtest_tests GTest::gtest_main)

# This will automatically add TEST_FRAMEWORK "gtest" to all discovered tests
discover_tests_with_location(my_gtest_tests gtest)

# Example 2: UnitTest++
find_package(UnitTest++ REQUIRED)
add_executable(my_unittest_tests test_main.cpp)
target_link_libraries(my_unittest_tests UnitTest++)

# This will automatically add TEST_FRAMEWORK "unittestpp" to all discovered tests
discover_tests_with_location(my_unittest_tests unittest-cpp)

# Example 3: Catch2
find_package(Catch2 3 REQUIRED)
add_executable(my_catch2_tests test_main.cpp)
target_link_libraries(my_catch2_tests Catch2::Catch2WithMain)

# This will automatically add TEST_FRAMEWORK "catch2" to all discovered tests
discover_tests_with_location(my_catch2_tests catch2)

# The generated CTestTestfile.cmake will include entries like:
# add_test("TestSuite::TestName" "/path/to/executable" "args...")
# set_tests_properties("TestSuite::TestName" PROPERTIES
#   WORKING_DIRECTORY "/path/to/build"
#   TEST_FILE "/path/to/test_file.cpp"
#   TEST_LINE "42"
#   TEST_FULL_NAME "TestSuite::TestName"
#   TEST_FRAMEWORK "gtest"  # or "unittestpp" or "catch2"
# )