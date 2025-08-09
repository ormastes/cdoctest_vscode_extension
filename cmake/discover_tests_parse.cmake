# discover_tests_parse.cmake
cmake_minimum_required(VERSION 3.18)
include(CTest)

if(NOT DEFINED TEST_TARGET OR NOT DEFINED XML_FILE)
  message(FATAL_ERROR
    "Usage: cmake -P discover_tests_parse.cmake "
    "-DTEST_TARGET=<target> -DXML_FILE=<file> "
    "[-DDISCOVER_TARGET=<cmake-target>]")
endif()

file(READ "${XML_FILE}" _xml_content)

string(REGEX MATCHALL
  "<testcase[^>]*name=\"([^\"]+)\"[^>]*file=\"([^\"]+)\"[^>]*line=\"([^\"]+)\""
  _entries
  "${_xml_content}"
)

foreach(_e IN LISTS _entries)
  string(REGEX REPLACE
    ".*name=\"([^\"]+)\"[^>]*file=\"([^\"]+)\"[^>]*line=\"([^\"]+)\".*"
    "\\1;\\2;\\3"
    _parts "${_e}"
  )
  list(GET _parts 0 _test_name)
  list(GET _parts 1 _test_file)
  list(GET _parts 2 _test_line)

  # human‐friendly CTest name: "<file>:<line> <suite>.<name>"
  set(_ctest_name "${_test_file}:${_test_line} ${_test_name}")

  if(DEFINED DISCOVER_TARGET)
    # PRE_TEST mode: make this test depend on the discovery target
    ctest_add_test(
      NAME    "${_ctest_name}"
      COMMAND "$<TARGET_FILE:${TEST_TARGET}>" --gtest_filter=${_test_name}
      DEPENDS ${DISCOVER_TARGET}
    )
  else()
    # POST_BUILD mode: just register it
    ctest_add_test(
      NAME    "${_ctest_name}"
      COMMAND "$<TARGET_FILE:${TEST_TARGET}>" --gtest_filter=${_test_name}
    )
  endif()
endforeach()
