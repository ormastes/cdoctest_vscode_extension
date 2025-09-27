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

    before(() => {
        // Setup: create mock files if needed
        if (!fs.existsSync(testCMakeFile)) {
            fs.writeFileSync(testCMakeFile, `# Test include\ninclude(\"${googletestSubdir}\")\nsubdirs(\"_deps/googletest-build\")\n# comment`);
        }
        if (!fs.existsSync(googletestSubdir)) {
            fs.writeFileSync(googletestSubdir, `# googletest dummy file`);
        }
    });

    after(() => {
        // Cleanup: remove mock files
        if (fs.existsSync(testCMakeFile)) {
            fs.unlinkSync(testCMakeFile);
        }
        if (fs.existsSync(googletestSubdir)) {
            fs.unlinkSync(googletestSubdir);
        }
    });

    it('should include files from include() and subdirs()', () => {
        const result = parser.recursiveIncludeCTestFile(testCMakeFile);
        expect(result).toContain(testCMakeFile);
        expect(result).toContain(googletestSubdir);
    });

    it('should ignore # comments', () => {
        const result = parser.recursiveIncludeCTestFile(testCMakeFile);
        // Should not throw or include comment lines
        expect(result).not.toContain('# comment');
    });

    it('should correctly parse raw CTest file with multiple tests and properties', () => {
        const rawCTestFile = path.join(testBuildDir, 'raw_ctest_file.cmake');
        const rawContent = `
add_test( MathTests.Addition C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.Addition]==] --gtest_also_run_disabled_tests)
set_tests_properties( MathTests.Addition PROPERTIES WORKING_DIRECTORY C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test( MathTests.Subtraction C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.Subtraction]==] --gtest_also_run_disabled_tests)
set_tests_properties( MathTests.Subtraction PROPERTIES WORKING_DIRECTORY C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test( MathTests.FAIL C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.FAIL]==] --gtest_also_run_disabled_tests)
set_tests_properties( MathTests.FAIL PROPERTIES WORKING_DIRECTORY C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test( MathTests.AddFunction C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=MathTests.AddFunction]==] --gtest_also_run_disabled_tests)
set_tests_properties( MathTests.AddFunction PROPERTIES WORKING_DIRECTORY C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
add_test( StringTests.Concatenation C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe [==[--gtest_filter=StringTests.Concatenation]==] --gtest_also_run_disabled_tests)
set_tests_properties( StringTests.Concatenation PROPERTIES WORKING_DIRECTORY C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build SKIP_REGULAR_EXPRESSION [==[[  SKIPPED ]]==])
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
        for (const test of tests) {
            expect(test.workingDirectory).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build');
            expect(test.executable).toBe('C:/dev/cdoctest_vscode_extension/test/integrated_unit_gtest_and_cdoctest_cmake_ctest/build/hello_test.exe');
            expect(test.args.length).toBeGreaterThan(0);
        }
        // Cleanup
        fs.unlinkSync(rawCTestFile);
    });
});
