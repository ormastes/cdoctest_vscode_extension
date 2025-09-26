# -----------------------------------------------------------------------------
# discover_tests_with_location()
#
# Usage:
#   discover_tests_with_location(<test-target> <framework> [<mode>])
#
#   <framework>  gtest | catch2 | unittest-cpp
#   <mode>       POST_BUILD (default) | PRE_TEST
# -----------------------------------------------------------------------------
function(discover_tests_with_location)
  if(ARGC LESS 2)
    message(FATAL_ERROR
      "discover_tests_with_location: expected at least 2 args: "
      "discover_tests_with_location(<target> <framework> [MODE])")
  endif()

  # peel off args
  set(TEST_TARGET   ${ARGV0})
  set(FRAMEWORK     ${ARGV1})
  if(ARGC GREATER 2)
    string(TOUPPER "${ARGV2}" MODE)
  else()
    set(MODE "POST_BUILD")
  endif()
  set(VALID_MODES "POST_BUILD" "PRE_TEST")
  if(NOT ${MODE} IN_LIST VALID_MODES)
    message(FATAL_ERROR
      "discover_tests_with_location: invalid MODE '${MODE}'. "
      "Use POST_BUILD or PRE_TEST.")
  endif()

  # locate the built executable using generator expression
  set(_exe $<TARGET_FILE:${TEST_TARGET}>)

  # Output file path for test discovery
  if(FRAMEWORK STREQUAL "gtest" OR FRAMEWORK STREQUAL "catch2")
    set(_output_file "${CMAKE_CURRENT_BINARY_DIR}/${TEST_TARGET}_discover.xml")
  else()
    set(_output_file "${CMAKE_CURRENT_BINARY_DIR}/${TEST_TARGET}_discover.txt")
  endif()

  # choose the right list+XML command arguments for each framework
  if(FRAMEWORK STREQUAL "gtest")
    # Google Test: output XML with test information
    set(_test_args --gtest_output=xml:${_output_file})
  elseif(FRAMEWORK STREQUAL "catch2")
    # Catch2 v3: XML reporter
    set(_test_args --reporter xml --out ${_output_file})
  elseif(FRAMEWORK STREQUAL "unittest-cpp")
    # UnitTest++: use GetTcList: to get test list
    set(_test_args GetTcList:)
  else()
    message(FATAL_ERROR
      "discover_tests_with_location: unsupported framework '${FRAMEWORK}'")
  endif()

  # Create the discovery script content
  set(_discover_script_content "
# Auto-generated test discovery script
set(TEST_EXECUTABLE \"${_exe}\")
set(OUTPUT_FILE \"${_output_file}\")
set(TEST_TARGET \"${TEST_TARGET}\")
set(CMAKE_CURRENT_SOURCE_DIR \"${CMAKE_CURRENT_SOURCE_DIR}\")
set(CMAKE_CURRENT_BINARY_DIR \"${CMAKE_CURRENT_BINARY_DIR}\")

# Run test discovery
if(\"${FRAMEWORK}\" STREQUAL \"unittest-cpp\")
  execute_process(
    COMMAND \${TEST_EXECUTABLE} GetTcList:
    OUTPUT_FILE \${OUTPUT_FILE}
    RESULT_VARIABLE result
  )
  if(NOT result EQUAL 0)
    message(FATAL_ERROR \"Test discovery failed with exit code: \${result}\")
  endif()
elseif(\"${FRAMEWORK}\" STREQUAL \"gtest\")
  # For gtest, we need to run the tests to generate XML with file/line info
  execute_process(
    COMMAND \${TEST_EXECUTABLE} --gtest_output=xml:\${OUTPUT_FILE}
    RESULT_VARIABLE result
    OUTPUT_QUIET
    ERROR_QUIET
  )
  # Don't fail on non-zero exit code as tests might fail
elseif(\"${FRAMEWORK}\" STREQUAL \"catch2\")
  # For catch2, we need to run the tests to generate XML with file/line info
  execute_process(
    COMMAND \${TEST_EXECUTABLE} --reporter xml --out \${OUTPUT_FILE}
    RESULT_VARIABLE result
    OUTPUT_QUIET
    ERROR_QUIET
  )
  # Don't fail on non-zero exit code as tests might fail
else()
  execute_process(
    COMMAND \${TEST_EXECUTABLE} ${_test_args}
    RESULT_VARIABLE result
  )
  if(NOT result EQUAL 0)
    message(FATAL_ERROR \"Test discovery failed with exit code: \${result}\")
  endif()
endif()

# Parse discovery output and generate CTest file
if(NOT EXISTS \"\${OUTPUT_FILE}\")
  message(WARNING \"Discovery output file does not exist: \${OUTPUT_FILE}\")
  return()
endif()

# Read the content
file(READ \"\${OUTPUT_FILE}\" _text_content)

# Framework-specific parsing
if(\"${FRAMEWORK}\" STREQUAL \"unittest-cpp\")
  # Parse text format: TestSuite::TestName,filename,linenumber
  string(REPLACE \"\\n\" \";\" _lines \"\${_text_content}\")
  
  # Create CTest file
  set(_ctest_file \"\${CMAKE_CURRENT_BINARY_DIR}/CTestTestfile.cmake\")
  
  # If we're in POST_BUILD mode, append to existing file
  if(EXISTS \"\${_ctest_file}\")
    file(READ \"\${_ctest_file}\" _existing_content)
    # Check if we already have our tests
    if(_existing_content MATCHES \"# BEGIN \${TEST_TARGET} tests\")
      # Remove old test entries
      string(REGEX REPLACE \"# BEGIN \${TEST_TARGET} tests.*# END \${TEST_TARGET} tests\\n\" \"\" _existing_content \"\${_existing_content}\")
      file(WRITE \"\${_ctest_file}\" \"\${_existing_content}\")
    endif()
  endif()
  
  # Write test entries
  file(APPEND \"\${_ctest_file}\" \"# BEGIN \${TEST_TARGET} tests\\n\")
  
  set(_test_count 0)
  foreach(_line IN LISTS _lines)
    # Skip empty lines
    if(_line STREQUAL \"\")
      continue()
    endif()
    
    # Parse format: TestSuite::TestName,filename,linenumber
    string(REGEX MATCH \"^([^,]+),([^,]+),([^,]+)$\" _match \"\${_line}\")
    if(_match)
      string(REGEX REPLACE \"^([^,]+),([^,]+),([^,]+)$\" \"\\\\1;\\\\2;\\\\3\" _parts \"\${_line}\")
      list(GET _parts 0 _full_test_name)
      list(GET _parts 1 _filename)
      list(GET _parts 2 _line_number)
      
      # Convert relative path to absolute path
      if(NOT IS_ABSOLUTE \"\${_filename}\")
        get_filename_component(_abs_filename \"\${CMAKE_CURRENT_SOURCE_DIR}/\${_filename}\" ABSOLUTE)
      else()
        set(_abs_filename \"\${_filename}\")
      endif()
      
      # Write to CTest file
      file(APPEND \"\${_ctest_file}\" \"add_test(\\\"\${_full_test_name}\\\" \\\"\${CMAKE_CURRENT_BINARY_DIR}/\${TEST_TARGET}\${CMAKE_EXECUTABLE_SUFFIX}\\\" \\\"TC/\${_full_test_name}\\\")\\n\")
      file(APPEND \"\${_ctest_file}\" \"set_tests_properties(\\\"\${_full_test_name}\\\" PROPERTIES\\n\")
      file(APPEND \"\${_ctest_file}\" \"  WORKING_DIRECTORY \\\"\${CMAKE_CURRENT_BINARY_DIR}\\\"\\n\")
      file(APPEND \"\${_ctest_file}\" \"  TEST_FILE \\\"\${_abs_filename}\\\"\\n\")
      file(APPEND \"\${_ctest_file}\" \"  TEST_LINE \\\"\${_line_number}\\\"\\n\")
      file(APPEND \"\${_ctest_file}\" \"  TEST_FULL_NAME \\\"\${_full_test_name}\\\"\\n\")
      file(APPEND \"\${_ctest_file}\" \"  TEST_FRAMEWORK \\\"unittestpp\\\"\\n\")
      file(APPEND \"\${_ctest_file}\" \")\\n\")
      math(EXPR _test_count \"\${_test_count} + 1\")
    endif()
  endforeach()
  
  file(APPEND \"\${_ctest_file}\" \"# END \${TEST_TARGET} tests\\n\")
  message(STATUS \"Discovered \${_test_count} tests from \${TEST_TARGET}\")
  
elseif(\"${FRAMEWORK}\" STREQUAL \"gtest\")
  # Parse Google Test XML format
  # The XML file should have been created by running with --gtest_output=xml
  
  # Read the XML content
  file(READ \"\${OUTPUT_FILE}\" _xml_content)
  
  # Create CTest file
  set(_ctest_file \"\${CMAKE_CURRENT_BINARY_DIR}/CTestTestfile.cmake\")
  
  # If we're in POST_BUILD mode, append to existing file
  if(EXISTS \"\${_ctest_file}\")
    file(READ \"\${_ctest_file}\" _existing_content)
    # Check if we already have our tests
    if(_existing_content MATCHES \"# BEGIN \${TEST_TARGET} tests\")
      # Remove old test entries
      string(REGEX REPLACE \"# BEGIN \${TEST_TARGET} tests.*# END \${TEST_TARGET} tests\\n\" \"\" _existing_content \"\${_existing_content}\")
      file(WRITE \"\${_ctest_file}\" \"\${_existing_content}\")
    endif()
  endif()
  
  # Write test entries
  file(APPEND \"\${_ctest_file}\" \"# BEGIN \${TEST_TARGET} tests\\n\")
  
  # Parse gtest XML format: <testcase name=\"TestName\" classname=\"SuiteName\" file=\"path\" line=\"123\"/>
  string(REGEX MATCHALL
    \"<testcase[^>]+name=\\\"([^\\\"]+)\\\"[^>]+classname=\\\"([^\\\"]+)\\\"[^>]*>\"
    _entries
    \"\${_xml_content}\"
  )
  
  set(_test_count 0)
  foreach(_entry IN LISTS _entries)
    # Extract test name and class name
    string(REGEX REPLACE
      \".*name=\\\"([^\\\"]+)\\\".*classname=\\\"([^\\\"]+)\\\".*\"
      \"\\\\2;\\\\1\"
      _parts \"\${_entry}\"
    )
    list(GET _parts 0 _suite_name)
    list(GET _parts 1 _test_name)
    set(_full_test_name \"\${_suite_name}.\${_test_name}\")
    
    # Try to extract file and line from the XML entry
    set(_test_file \"\${CMAKE_CURRENT_SOURCE_DIR}/test_main.cpp\")
    set(_test_line \"0\")
    
    # Look for file attribute
    if(_entry MATCHES \"file=\\\"([^\\\"]+)\\\"\")
      set(_test_file \"\${CMAKE_MATCH_1}\")
      # Convert relative path to absolute
      if(NOT IS_ABSOLUTE \"\${_test_file}\")
        get_filename_component(_test_file \"\${CMAKE_CURRENT_SOURCE_DIR}/\${_test_file}\" ABSOLUTE)
      endif()
    endif()
    
    # Look for line attribute
    if(_entry MATCHES \"line=\\\"([0-9]+)\\\"\")
      set(_test_line \"\${CMAKE_MATCH_1}\")
    endif()
    
    # Write to CTest file
    file(APPEND \"\${_ctest_file}\" \"add_test(\\\"\${_full_test_name}\\\" \\\"\${CMAKE_CURRENT_BINARY_DIR}/\${TEST_TARGET}\${CMAKE_EXECUTABLE_SUFFIX}\\\" \\\"--gtest_filter=\${_full_test_name}\\\")\\n\")
    file(APPEND \"\${_ctest_file}\" \"set_tests_properties(\\\"\${_full_test_name}\\\" PROPERTIES\\n\")
    file(APPEND \"\${_ctest_file}\" \"  WORKING_DIRECTORY \\\"\${CMAKE_CURRENT_BINARY_DIR}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FILE \\\"\${_test_file}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_LINE \\\"\${_test_line}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FULL_NAME \\\"\${_full_test_name}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FRAMEWORK \\\"gtest\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \")\\n\")
    math(EXPR _test_count \"\${_test_count} + 1\")
  endforeach()
  
  file(APPEND \"\${_ctest_file}\" \"# END \${TEST_TARGET} tests\\n\")
  message(STATUS \"Discovered \${_test_count} tests from \${TEST_TARGET}\")
  
elseif(\"${FRAMEWORK}\" STREQUAL \"catch2\")
  # Parse Catch2 XML format
  # Read the XML content
  file(READ \"\${OUTPUT_FILE}\" _xml_content)
  
  # Create CTest file
  set(_ctest_file \"\${CMAKE_CURRENT_BINARY_DIR}/CTestTestfile.cmake\")
  
  # If we're in POST_BUILD mode, append to existing file
  if(EXISTS \"\${_ctest_file}\")
    file(READ \"\${_ctest_file}\" _existing_content)
    # Check if we already have our tests
    if(_existing_content MATCHES \"# BEGIN \${TEST_TARGET} tests\")
      # Remove old test entries
      string(REGEX REPLACE \"# BEGIN \${TEST_TARGET} tests.*# END \${TEST_TARGET} tests\\n\" \"\" _existing_content \"\${_existing_content}\")
      file(WRITE \"\${_ctest_file}\" \"\${_existing_content}\")
    endif()
  endif()
  
  # Write test entries
  file(APPEND \"\${_ctest_file}\" \"# BEGIN \${TEST_TARGET} tests\\n\")
  
  # Parse Catch2 XML format: <TestCase name=\"TestName\" filename=\"path\" line=\"123\">
  string(REGEX MATCHALL
    \"<TestCase[^>]+name=\\\"([^\\\"]+)\\\"[^>]*>\"
    _entries
    \"\${_xml_content}\"
  )
  
  set(_test_count 0)
  foreach(_entry IN LISTS _entries)
    # Extract test name
    string(REGEX REPLACE
      \".*name=\\\"([^\\\"]+)\\\".*\"
      \"\\\\1\"
      _test_name \"\${_entry}\"
    )
    
    # Try to extract file and line from the XML entry
    set(_test_file \"\${CMAKE_CURRENT_SOURCE_DIR}/test_main.cpp\")
    set(_test_line \"0\")
    
    # Look for filename attribute
    if(_entry MATCHES \"filename=\\\"([^\\\"]+)\\\"\")
      set(_test_file \"\${CMAKE_MATCH_1}\")
      # Convert relative path to absolute
      if(NOT IS_ABSOLUTE \"\${_test_file}\")
        get_filename_component(_test_file \"\${CMAKE_CURRENT_SOURCE_DIR}/\${_test_file}\" ABSOLUTE)
      endif()
    endif()
    
    # Look for line attribute
    if(_entry MATCHES \"line=\\\"([0-9]+)\\\"\")
      set(_test_line \"\${CMAKE_MATCH_1}\")
    endif()
    
    # Write to CTest file
    file(APPEND \"\${_ctest_file}\" \"add_test(\\\"\${_test_name}\\\" \\\"\${CMAKE_CURRENT_BINARY_DIR}/\${TEST_TARGET}\${CMAKE_EXECUTABLE_SUFFIX}\\\" \\\"\${_test_name}\\\")\\n\")
    file(APPEND \"\${_ctest_file}\" \"set_tests_properties(\\\"\${_test_name}\\\" PROPERTIES\\n\")
    file(APPEND \"\${_ctest_file}\" \"  WORKING_DIRECTORY \\\"\${CMAKE_CURRENT_BINARY_DIR}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FILE \\\"\${_test_file}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_LINE \\\"\${_test_line}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FULL_NAME \\\"\${_test_name}\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \"  TEST_FRAMEWORK \\\"catch2\\\"\\n\")
    file(APPEND \"\${_ctest_file}\" \")\\n\")
    math(EXPR _test_count \"\${_test_count} + 1\")
  endforeach()
  
  file(APPEND \"\${_ctest_file}\" \"# END \${TEST_TARGET} tests\\n\")
  message(STATUS \"Discovered \${_test_count} tests from \${TEST_TARGET}\")
  
endif()
")

  # Write the discovery script to a file
  set(_discover_script "${CMAKE_CURRENT_BINARY_DIR}/$<IF:$<BOOL:$<CONFIG>>,$<CONFIG>/,>${TEST_TARGET}_discover.cmake")
  file(GENERATE OUTPUT "${_discover_script}" CONTENT "${_discover_script_content}")
 
  if(MODE STREQUAL "POST_BUILD")
    add_custom_command(
      TARGET   ${TEST_TARGET}
      POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E echo "Discovering ${FRAMEWORK} tests in ${TEST_TARGET}..."
      COMMAND ${CMAKE_COMMAND} -P "${_discover_script}"
      COMMENT "Registering ${FRAMEWORK} tests (file+line) for ${TEST_TARGET}"
    )
  else()  # PRE_TEST
    set(_discover_target "discover_${TEST_TARGET}")
    add_custom_target(${_discover_target}
      COMMAND ${CMAKE_COMMAND} -E echo "Discovering ${FRAMEWORK} tests for ${TEST_TARGET}..."
      COMMAND ${CMAKE_COMMAND} -P "${_discover_script}"
      DEPENDS ${TEST_TARGET}
      COMMENT "Creating PRE_TEST discovery target for ${TEST_TARGET}"
    )
  endif()
endfunction()
