# Subdirectory tests
add_library(hello_subdir_lib SHARED hello_test.cpp)
target_link_libraries(hello_subdir_lib UnitTest++)

add_executable(hello_subdir_test hello_entry.cpp)
target_link_libraries(hello_subdir_test hello_subdir_lib)

# Discover tests with location for subdirectory
discover_tests_with_location(hello_subdir_test unittest-cpp)