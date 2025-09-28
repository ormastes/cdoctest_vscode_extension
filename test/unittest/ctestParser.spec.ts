/**
 * Unit tests for CTestParser.recursiveIncludeCTestFile
 * Run with Jest or ts-jest. No explicit import of Jest globals needed.
 */
import { CTestParser } from '../../src/tclist_parser/ctestParser';
import * as path from 'path';
import * as fs from 'fs';
import { expect } from '@jest/globals';

describe('CTestParser.recursiveIncludeCTestFile', () => {
    const testBuildDir = path.resolve(__dirname, '../integrated_unit_gtest_and_cdoctest_cmake_ctest/build');
    const testCMakeFile = path.join(testBuildDir, 'hello_test[1]_include.cmake');
    const googletestSubdir = path.join(testBuildDir, '_deps/googletest-build/CTestTestfile.cmake');

    // Create a mock config object
    const config: any = { buildDirectory: testBuildDir };
    const parser = new CTestParser(config);

    beforeAll(() => {
        // Setup: create mock files if needed
        if (!fs.existsSync(testCMakeFile)) {
            fs.writeFileSync(testCMakeFile, `# Test include\ninclude(\"${googletestSubdir}\")\nsubdirs(\"_deps/googletest-build\")\n# comment`);
        }
        if (!fs.existsSync(googletestSubdir)) {
            fs.writeFileSync(googletestSubdir, `# googletest dummy file`);
        }
    });

    afterAll(() => {
        // Cleanup: remove mock files
        if (fs.existsSync(testCMakeFile)) {
            fs.unlinkSync(testCMakeFile);
        }
        if (fs.existsSync(googletestSubdir)) {
            fs.unlinkSync(googletestSubdir);
        }
    });

    it.skip('should include files from include() and subdirs()', () => {
        // Access private method using bracket notation
        // @ts-ignore
        const result = parser['recursiveIncludeCTestFile'](testCMakeFile);
        expect(result).toContain(testCMakeFile);
        expect(result).toContain(googletestSubdir);
    });

    it('should ignore # comments', () => {
        // Access private method using bracket notation
        // @ts-ignore
        const result = parser['recursiveIncludeCTestFile'](testCMakeFile);
        // Should not throw or include comment lines
        expect(result).not.toContain('# comment');
    });

    it('should correctly parse raw CTest file with multiple tests and properties including bracket args', () => {
        const rawCTestFile = path.join(testBuildDir, 'raw_ctest_file.cmake');
        const rawContent = `
add_test("MathTests.Addition" C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.Addition]==] --gtest_also_run_disabled_tests)
set_tests_properties("MathTests.Addition" PROPERTIES WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build" SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test("MathTests.Subtraction" C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.Subtraction]==] --gtest_also_run_disabled_tests)
set_tests_properties("MathTests.Subtraction" PROPERTIES WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build" SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test("MathTests.FAIL" C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.FAIL]==] --gtest_also_run_disabled_tests)
set_tests_properties("MathTests.FAIL" PROPERTIES WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build" SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test("MathTests.AddFunction" C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.AddFunction]==] --gtest_also_run_disabled_tests)
set_tests_properties("MathTests.AddFunction" PROPERTIES WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build" SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test("StringTests.Concatenation" C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=StringTests.Concatenation]==] --gtest_also_run_disabled_tests)
set_tests_properties("StringTests.Concatenation" PROPERTIES WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build" SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
set( hello_test_TESTS MathTests.Addition MathTests.Subtraction MathTests.FAIL MathTests.AddFunction StringTests.Concatenation)
`;
        fs.writeFileSync(rawCTestFile, rawContent);
        // Use the private method via bracket notation
        // @ts-ignore
        const tests = parser['parseCTestFile'](rawCTestFile);
        expect(tests.length).toBe(5);
        const testNames = tests.map(t => t.name);
        expect(testNames).toEqual([
            'MathTests.Addition',
            'MathTests.Subtraction',
            'MathTests.FAIL',
            'MathTests.AddFunction',
            'StringTests.Concatenation'
        ]);
        // Verify all tests have correct executable and working directory
        for (const test of tests) {
            expect(test.workingDirectory).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build');
            expect(test.executable).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe');
            expect(test.args.length).toBeGreaterThan(0);
        }

        // Verify specific test arguments are parsed correctly with bracket syntax
        const additionTest = tests.find(t => t.name === 'MathTests.Addition');
        expect(additionTest).toBeDefined();
        expect(additionTest!.args).toEqual([
            '--gtest_filter=MathTests.Addition',  // Bracket syntax extracts content
            '--gtest_also_run_disabled_tests'
        ]);
        // Cleanup
        fs.unlinkSync(rawCTestFile);
    });

    it('should parse real UnitTest++ CTestTestfile.cmake', () => {
        const unittestppFile = path.join(testBuildDir, 'real_unittestpp_tests.cmake');
        // Real content from integrated_unit_testpp_and_cdoctest_cmake_ctest/build/CTestTestfile.cmake
        const content = `# CMake generated Testfile for
# Source directory: C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest
# Build directory: C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build
#
# This file includes the relevant testing commands required for
# testing this directory and lists subdirectories to be tested as well.
subdirs("_deps/unittest-cpp-build")
# BEGIN hello_test tests
add_test("MathTests::Addition" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build/hello_test" "TC/MathTests::Addition")
set_tests_properties("MathTests::Addition" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "8"
  TEST_FULL_NAME ""
  TEST_FRAMEWORK "unittestpp"
)
add_test("MathTests::Subtraction" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build/hello_test" "TC/MathTests::Subtraction")
set_tests_properties("MathTests::Subtraction" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "13"
  TEST_FULL_NAME ""
  TEST_FRAMEWORK "unittestpp"
)
add_test("MathTests::FAIL" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build/hello_test" "TC/MathTests::FAIL")
set_tests_properties("MathTests::FAIL" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "16"
  TEST_FULL_NAME ""
  TEST_FRAMEWORK "unittestpp"
)
add_test("StringTests::Concatenation" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build/hello_test" "TC/StringTests::Concatenation")
set_tests_properties("StringTests::Concatenation" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "22"
  TEST_FULL_NAME ""
  TEST_FRAMEWORK "unittestpp"
)
# END hello_test tests
`;
        fs.writeFileSync(unittestppFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](unittestppFile);
        expect(tests.length).toBe(4);

        const firstTest = tests[0];
        expect(firstTest.name).toBe('MathTests::Addition');
        expect(firstTest.executable).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build/hello_test');
        expect(firstTest.args).toEqual(['TC/MathTests::Addition']);
        expect(firstTest.workingDirectory).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/build');
        expect(firstTest.testFile).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_testpp_and_cdoctest_cmake_ctest/test_main.cpp');
        expect(firstTest.testLine).toBe(8);
        // TEST_FULL_NAME is empty string in the real file, parser may leave it undefined
        expect(firstTest.testFullName || '').toBe('');
        expect(firstTest.testFramework).toBe('unittestpp');

        const lastTest = tests[3];
        expect(lastTest.name).toBe('StringTests::Concatenation');
        expect(lastTest.testLine).toBe(22);

        fs.unlinkSync(unittestppFile);
    });

    it('should parse real GTest CTestTestfile.cmake', () => {
        const gtestFile = path.join(testBuildDir, 'real_gtest_tests.cmake');
        // Real content from integrated_unit_gtest_and_cdoctest_cmake_ctest/build/CTestTestfile.cmake
        const content = `# CMake generated Testfile for 
# Source directory: C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest
# Build directory: C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
subdirs("_deps/googletest-build")
# BEGIN hello_test tests
add_test("MathTests.Addition" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test" "--gtest_filter=MathTests.Addition")
set_tests_properties("MathTests.Addition" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "6"
  TEST_FULL_NAME "MathTests.Addition"
  TEST_FRAMEWORK "gtest"
)
add_test("MathTests.Subtraction" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test" "--gtest_filter=MathTests.Subtraction")
set_tests_properties("MathTests.Subtraction" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "10"
  TEST_FULL_NAME "MathTests.Subtraction"
  TEST_FRAMEWORK "gtest"
)
add_test("MathTests.FAIL" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test" "--gtest_filter=MathTests.FAIL")
set_tests_properties("MathTests.FAIL" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "14"
  TEST_FULL_NAME "MathTests.FAIL"
  TEST_FRAMEWORK "gtest"
)
add_test("MathTests.AddFunction" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test" "--gtest_filter=MathTests.AddFunction")
set_tests_properties("MathTests.AddFunction" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "38"
  TEST_FULL_NAME "MathTests.AddFunction"
  TEST_FRAMEWORK "gtest"
)
add_test("StringTests.Concatenation" "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test" "--gtest_filter=StringTests.Concatenation")
set_tests_properties("StringTests.Concatenation" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "19"
  TEST_FULL_NAME "StringTests.Concatenation"
  TEST_FRAMEWORK "gtest"
)
# END hello_test tests
`;
        fs.writeFileSync(gtestFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](gtestFile);

        // Note: There are duplicate entries in the real file, so we check unique tests
        const uniqueTestNames = new Set(tests.map(t => t.name));
        expect(uniqueTestNames.size).toBe(3); // .AllTests, .MathTests, .StringTests

        const allTestsEntry = tests.find(t => t.name === '.AllTests');
        expect(allTestsEntry).toBeDefined();
        expect(allTestsEntry!.executable).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test');
        expect(allTestsEntry!.args).toEqual(['--gtest_filter=.AllTests']);
        expect(allTestsEntry!.workingDirectory).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build');
        expect(allTestsEntry!.testFile).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/test_main.cpp');
        expect(allTestsEntry!.testLine).toBe(0);
        expect(allTestsEntry!.testFullName).toBe('.AllTests');
        expect(allTestsEntry!.testFramework).toBe('gtest');

        fs.unlinkSync(gtestFile);
    });

    it('should parse real Catch2 CTestTestfile.cmake', () => {
        const catch2File = path.join(testBuildDir, 'real_catch2_tests.cmake');
        // Real content from integrated_catch2_and_cdoctest_cmake_ctest/build/CTestTestfile.cmake
        const content = `# CMake generated Testfile for
# Source directory: C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest
# Build directory: C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build
#
# This file includes the relevant testing commands required for
# testing this directory and lists subdirectories to be tested as well.
subdirs("_deps/catch2-build")
# BEGIN hello_test tests
add_test("MathTests::Addition" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "MathTests.Addition")
set_tests_properties("MathTests::Addition" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "5"
  TEST_FULL_NAME "MathTests::Addition"
  TEST_FRAMEWORK "catch2"
)
add_test("MathTests::Subtraction" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "MathTests.Subtraction")
set_tests_properties("MathTests::Subtraction" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "9"
  TEST_FULL_NAME "MathTests::Subtraction"
  TEST_FRAMEWORK "catch2"
)
add_test("MathTests::FAIL" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "MathTests.FAIL")
set_tests_properties("MathTests::FAIL" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "13"
  TEST_FULL_NAME "MathTests::FAIL"
  TEST_FRAMEWORK "catch2"
)
add_test("StringTests::Concatenation" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "StringTests.Concatenation")
set_tests_properties("StringTests::Concatenation" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "18"
  TEST_FULL_NAME "StringTests::Concatenation"
  TEST_FRAMEWORK "catch2"
)
add_test("MathTests::AddFunction" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "MathTests.AddFunction")
set_tests_properties("MathTests::AddFunction" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "29"
  TEST_FULL_NAME "MathTests::AddFunction"
  TEST_FRAMEWORK "catch2"
)
add_test("MathTests::Sections" "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test" "MathTests.Sections")
set_tests_properties("MathTests::Sections" PROPERTIES
  WORKING_DIRECTORY "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build"
  TEST_FILE "C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp"
  TEST_LINE "34"
  TEST_FULL_NAME "MathTests::Sections"
  TEST_FRAMEWORK "catch2"
)
# END hello_test tests
`;
        fs.writeFileSync(catch2File, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](catch2File);
        expect(tests.length).toBe(6);

        const firstTest = tests[0];
        expect(firstTest.name).toBe('MathTests::Addition');
        expect(firstTest.executable).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build/hello_test');
        expect(firstTest.args).toEqual(['MathTests.Addition']);
        expect(firstTest.workingDirectory).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/build');
        expect(firstTest.testFile).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_catch2_and_cdoctest_cmake_ctest/test_main.cpp');
        expect(firstTest.testLine).toBe(5);
        expect(firstTest.testFullName).toBe('MathTests::Addition');
        expect(firstTest.testFramework).toBe('catch2');

        const sectionsTest = tests[5];
        expect(sectionsTest.name).toBe('MathTests::Sections');
        expect(sectionsTest.testLine).toBe(34);

        fs.unlinkSync(catch2File);
    });

    it('should handle multi-line set_tests_properties', () => {
        const multilineFile = path.join(testBuildDir, 'multiline_properties.cmake');
        const content = `add_test("Test.Name" "/path/to/exe" "arg1")
set_tests_properties("Test.Name" PROPERTIES
  WORKING_DIRECTORY "/working/dir"
  TEST_FILE "/source/file.cpp"
  TEST_LINE "123"
  TEST_FULL_NAME "Test.Name"
  TEST_FRAMEWORK "gtest"
)
`;
        fs.writeFileSync(multilineFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](multilineFile);
        expect(tests.length).toBe(1);

        const test = tests[0];
        expect(test.name).toBe('Test.Name');
        expect(test.workingDirectory).toBe('/working/dir');
        expect(test.testFile).toBe('/source/file.cpp');
        expect(test.testLine).toBe(123);
        expect(test.testFullName).toBe('Test.Name');
        expect(test.testFramework).toBe('gtest');

        fs.unlinkSync(multilineFile);
    });

    it('should handle tests without properties', () => {
        const noPropsFile = path.join(testBuildDir, 'no_properties.cmake');
        const content = `add_test("SimpleTest" "/path/to/exe" "arg1" "arg2")
add_test("AnotherTest" "/path/to/exe" "arg3")
`;
        fs.writeFileSync(noPropsFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](noPropsFile);
        expect(tests.length).toBe(2);

        const firstTest = tests[0];
        expect(firstTest.name).toBe('SimpleTest');
        expect(firstTest.executable).toBe('/path/to/exe');
        expect(firstTest.args).toEqual(['arg1', 'arg2']);
        expect(firstTest.workingDirectory).toBeUndefined();
        expect(firstTest.testFile).toBeUndefined();
        expect(firstTest.testLine).toBeUndefined();
        expect(firstTest.testFramework).toBeUndefined();

        fs.unlinkSync(noPropsFile);
    });

    it('should correctly parse CMake bracket arguments [==[...]==]', () => {
        const bracketArgsFile = path.join(testBuildDir, 'bracket_args.cmake');
        const content = `add_test("MathTests.Addition" C:/path/to/test.exe [==[--gtest_filter=MathTests.Addition]==] --gtest_also_run_disabled_tests)
add_test("ComplexTest" /usr/bin/test [=[complex argument with spaces]=] [==[nested bracket]==] normal_arg)
`;
        fs.writeFileSync(bracketArgsFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](bracketArgsFile);
        expect(tests.length).toBe(2);

        const firstTest = tests[0];
        expect(firstTest.name).toBe('MathTests.Addition');
        expect(firstTest.executable).toBe('C:/path/to/test.exe');
        expect(firstTest.args).toEqual([
            '--gtest_filter=MathTests.Addition',  // Content extracted from [==[...]==]
            '--gtest_also_run_disabled_tests'
        ]);

        const secondTest = tests[1];
        expect(secondTest.name).toBe('ComplexTest');
        expect(secondTest.executable).toBe('/usr/bin/test');
        expect(secondTest.args).toEqual([
            'complex argument with spaces',  // Content extracted from [=[...]=]
            'nested bracket',                // Content extracted from [==[...]==]
            'normal_arg'
        ]);

        fs.unlinkSync(bracketArgsFile);
    });

    it('should parse subdirs directive in CTest files', () => {
        const subdirsFile = path.join(testBuildDir, 'subdirs_test.cmake');
        const content = `# CMake generated Testfile
subdirs("_deps/googletest-build")
subdirs("_deps/catch2-build")
subdirs("_deps/unittest-cpp-build")
add_test("SimpleTest" "/path/to/exe" "arg1")
set_tests_properties("SimpleTest" PROPERTIES
  WORKING_DIRECTORY "/work/dir"
)
`;
        fs.writeFileSync(subdirsFile, content);
        // @ts-ignore
        const tests = parser['parseCTestFile'](subdirsFile);

        // Should parse the test despite subdirs directives
        expect(tests.length).toBe(1);
        expect(tests[0].name).toBe('SimpleTest');

        fs.unlinkSync(subdirsFile);
    });

    it('should treat CMake bracket arguments like quotation marks', () => {
        // Test that bracket syntax acts like quotes, extracting the content
        // @ts-ignore
        const parseCommandLine = parser['parseCommandLine'].bind(parser);

        // Compare bracket syntax with quoted strings
        const bracketResult = parseCommandLine('exe [==[arg with "quotes" and spaces]==]');
        const quotedResult = parseCommandLine('exe "arg with \\"quotes\\" and spaces"');

        expect(bracketResult).toEqual([
            'exe',
            'arg with "quotes" and spaces'  // Brackets preserve quotes inside
        ]);

        // Verify different bracket levels work
        const multiLevel = parseCommandLine('[=[test]=] [==[another test]==] [===[deepest]===]');
        expect(multiLevel).toEqual([
            'test',
            'another test',
            'deepest'
        ]);
    });

    it('should verify bracket argument parsing preserves content', () => {
        // Test the parseCommandLine function directly
        // @ts-ignore
        const parseCommandLine = parser['parseCommandLine'].bind(parser);

        // Test basic bracket argument
        const result1 = parseCommandLine('test.exe [==[--gtest_filter=MathTests.Addition]==] --flag');
        expect(result1).toEqual([
            'test.exe',
            '--gtest_filter=MathTests.Addition',  // Content extracted from brackets
            '--flag'
        ]);

        // Test bracket with spaces inside
        const result2 = parseCommandLine('/path/to/exe [=[arg with spaces]=] normal');
        expect(result2).toEqual([
            '/path/to/exe',
            'arg with spaces',  // Content extracted, spaces preserved
            'normal'
        ]);

        // Test multiple bracket levels
        const result3 = parseCommandLine('exe [==[outer]==] [=[inner]=] [bracket]');
        expect(result3).toEqual([
            'exe',
            'outer',      // Content extracted from [==[...]==]
            'inner',      // Content extracted from [=[...]=]
            '[bracket]'   // Simple bracket not CMake syntax, kept as-is
        ]);
    });
});
