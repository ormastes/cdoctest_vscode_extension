import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../config';

export interface CTestCase {
    name: string;
    executable: string;
    args: string[];
    workingDirectory?: string;
    testFile?: string;
    testLine?: number;
    testFullName?: string;
    testFramework?: 'gtest' | 'unittestpp' | 'catch2' | string;
}

export interface CTestParseResult {
    tests: CTestCase[];
    errors: string[];
}

export class CTestParser {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    private findCTestFiles(): string[] {
        const files: string[] = [];
        const buildDirectory = this.config.buildDirectory;
        const baseFile = path.join(buildDirectory, 'CTestTestfile.cmake');
        
        if (fs.existsSync(baseFile)) {
            files.push(baseFile);
        }

        // Check if this is a multi-config generator (determined by presence of build type subdirectories)
        const buildType = this.config.cmakeBuildType;
        if (buildType) {
            const configFile = path.join(buildDirectory, buildType, 'CTestTestfile.cmake');
            if (fs.existsSync(configFile)) {
                files.push(configFile);
                return files; // Return early if we found the specific build type
            }
        }
        
        // Otherwise check all common configurations
        const configs = ['Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel'];
        for (const config of configs) {
            const configFile = path.join(buildDirectory, config, 'CTestTestfile.cmake');
            if (fs.existsSync(configFile)) {
                files.push(configFile);
            }
        }

        return files;
    }

    private parseCTestFile(filePath: string): CTestCase[] {
        const tests: CTestCase[] = [];
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            let currentTest: CTestCase | null = null;
            let inSetProperties = false;
            let currentTestName = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                const addTestMatch = line.match(/^add_test\s*\(\s*"([^"]+)"\s+(.+)\)$/);
                if (addTestMatch) {
                    const testName = addTestMatch[1];
                    const commandParts = this.parseCommandLine(addTestMatch[2]);
                    
                    if (commandParts.length > 0) {
                        currentTest = {
                            name: testName,
                            executable: commandParts[0].replace(/"/g, ''),
                            args: commandParts.slice(1).map(arg => arg.replace(/"/g, ''))
                        };
                        tests.push(currentTest);
                    }
                }

                const setPropsMatch = line.match(/^set_tests_properties\s*\(\s*"([^"]+)"\s+PROPERTIES/);
                if (setPropsMatch) {
                    currentTestName = setPropsMatch[1];
                    inSetProperties = true;
                    currentTest = tests.find(t => t.name === currentTestName) || null;
                }

                if (inSetProperties && currentTest) {
                    const workingDirMatch = line.match(/WORKING_DIRECTORY\s+"([^"]+)"/);
                    if (workingDirMatch) {
                        currentTest.workingDirectory = workingDirMatch[1];
                    }

                    const testFileMatch = line.match(/TEST_FILE\s+"([^"]+)"/);
                    if (testFileMatch) {
                        currentTest.testFile = testFileMatch[1];
                    }

                    const testLineMatch = line.match(/TEST_LINE\s+"(\d+)"/);
                    if (testLineMatch) {
                        currentTest.testLine = parseInt(testLineMatch[1]);
                    }

                    const testFullNameMatch = line.match(/TEST_FULL_NAME\s+"([^"]+)"/);
                    if (testFullNameMatch) {
                        currentTest.testFullName = testFullNameMatch[1];
                    }

                    const testFrameworkMatch = line.match(/TEST_FRAMEWORK\s+"([^"]+)"/);
                    if (testFrameworkMatch) {
                        currentTest.testFramework = testFrameworkMatch[1];
                    }

                    if (line.includes(')')) {
                        inSetProperties = false;
                        currentTest = null;
                    }
                }
            }
        } catch (error) {
            console.error(`Error parsing CTest file ${filePath}:`, error);
        }

        return tests;
    }

    private parseCommandLine(commandLine: string): string[] {
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        let escapeNext = false;

        for (let i = 0; i < commandLine.length; i++) {
            const char = commandLine[i];

            if (escapeNext) {
                current += char;
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                if (inQuotes) {
                    parts.push('"' + current + '"');
                    current = '';
                    inQuotes = false;
                } else {
                    inQuotes = true;
                }
                continue;
            }

            if (char === ' ' && !inQuotes) {
                if (current.length > 0) {
                    parts.push(current);
                    current = '';
                }
                continue;
            }

            current += char;
        }

        if (current.length > 0) {
            parts.push(current);
        }

        return parts;
    }

    public async parse(): Promise<CTestParseResult> {
        const result: CTestParseResult = {
            tests: [],
            errors: []
        };

        const ctestFiles = this.findCTestFiles();
        
        if (ctestFiles.length === 0) {
            result.errors.push(`No CTest files found in ${this.config.buildDirectory}`);
            return result;
        }

        for (const file of ctestFiles) {
            try {
                const tests = this.parseCTestFile(file);
                result.tests.push(...tests);
            } catch (error) {
                result.errors.push(`Error parsing ${file}: ${error}`);
            }
        }

        return result;
    }

    public async watchForChanges(callback: () => void): Promise<vscode.Disposable> {
        const watchers: vscode.FileSystemWatcher[] = [];
        
        const basePattern = new vscode.RelativePattern(this.config.buildDirectory, '**/CTestTestfile.cmake');
        const watcher = vscode.workspace.createFileSystemWatcher(basePattern);
        
        watcher.onDidChange(() => callback());
        watcher.onDidCreate(() => callback());
        watcher.onDidDelete(() => callback());
        
        watchers.push(watcher);

        return new vscode.Disposable(() => {
            watchers.forEach(w => w.dispose());
        });
    }
}