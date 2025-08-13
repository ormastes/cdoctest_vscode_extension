Feature: VSCode Extension Loading
  As a developer
  I want to ensure the cdoctest extension loads properly
  So that I can use it to test my code

  Background:
    Given VSCode is running with the test workspace

  Scenario: Extension loads successfully in VSCode
    When I open the workspace "test/integrated_unit_gtest_and_cdoctest_cmake_ctest"
    Then the cdoctest extension should be loaded
    And the extension should be activated
    And the Testing view should be available

  Scenario: Extension dependencies are loaded
    When I open the workspace "test/integrated_unit_gtest_and_cdoctest_cmake_ctest"
    Then the CMake Tools extension should be loaded
    And the LLDB DAP extension should be loaded

  Scenario: Extension appears in the extensions list
    When I open the Extensions view
    Then I should see "cdoctest" in the installed extensions
    And the extension version should be "0.5.0"

  Scenario: Testing view shows test discovery
    When I open the workspace "test/integrated_unit_gtest_and_cdoctest_cmake_ctest"
    And I open the Testing view
    And I wait for test discovery to complete
    Then I should see test items in the Testing explorer
    And the test tree should contain "MathTests"
    And the test tree should contain "StringTests"

  Scenario: Run StringTests Concatenation and verify result
    Given the test result file "test_concatenation_result.txt" does not exist
    When I open the workspace "test/integrated_unit_gtest_and_cdoctest_cmake_ctest"
    And I open the Testing view
    And I wait for test discovery to complete
    And I run the test "StringTests::Concatenation"
    And I wait for the test to complete
    Then the test should pass with a success message
    And the file "test_concatenation_result.txt" should exist in the build directory
    And the file should contain "Test StringTests.Concatenation passed!"
    And the file should contain "Result: Hello World"