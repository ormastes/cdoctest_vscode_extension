import { expect } from '@jest/globals';
import { CTestParser } from '../../src/tclist_parser/ctestParser';

describe('CTestParser regex patterns tests', () => {
    const mockConfig = {} as any; // Mock config object
    const parser = new CTestParser(mockConfig);
    const parseCommandLine = (cmd: string) => (parser as any).parseCommandLine(cmd);

    it('should parse simple command', () => {
        const result = parseCommandLine('/path/to/exe arg1 arg2');
        expect(result).toEqual(['/path/to/exe', 'arg1', 'arg2']);
    });

    it('should parse quoted arguments', () => {
        const result = parseCommandLine('/path/to/exe "arg with spaces" arg2');
        expect(result).toEqual(['/path/to/exe', '"arg with spaces"', 'arg2']);
    });

    it('should handle escaped quotes', () => {
        const result = parseCommandLine('/path/to/exe arg\\"1 arg2');
        expect(result).toEqual(['/path/to/exe', 'arg"1', 'arg2']);
    });

    it('should handle multiple spaces', () => {
        const result = parseCommandLine('/path/to/exe   arg1    arg2');
        expect(result).toEqual(['/path/to/exe', 'arg1', 'arg2']);
    });

    it('should handle complex gtest filter', () => {
        const result = parseCommandLine('test.exe [==[--gtest_filter=MathTests.Addition]==] --gtest_also_run_disabled_tests');
        expect(result).toEqual(['test.exe', '--gtest_filter=MathTests.Addition', '--gtest_also_run_disabled_tests']);
    });

    it('should handle empty string', () => {
        const result = parseCommandLine('');
        expect(result).toEqual([]);
    });

    it('should handle only spaces', () => {
        const result = parseCommandLine('   ');
        expect(result).toEqual([]);
    });
});