import * as vscode from 'vscode';
import * as path from 'path';
import { Config } from '../config';
import { MarkdownFileCoverage } from '../coverage';
import { getConfigByController } from './controller';
import { CTestParser, CTestCase } from '../tclist_parser/ctestParser';

// Store CTest data for test execution
const ctestDataMap = new Map<string, CTestCase>();

export function getTestRunHandler( test: vscode.TestItem, config: Config, run: vscode.TestRun,  resolve: () => void): ((result: string) => void) {
    return (result: string): void => {
        if (result.match(config.resultSuccessRgex)) {
            run.passed(test, 1000);
        } else {
            console.error(`Test failed: ${result}`);
            run.failed(test, new Error(`Test failed: ${result}`), 1000);
        }
        resolve();
    };
}

export function getTestRunHandlerWithExitCode( test: vscode.TestItem, config: Config, run: vscode.TestRun,  resolve: () => void): ((result: string, exitCode?: number) => void) {
    return (result: string, exitCode?: number): void => {
        // When using CTest discovery, we may only have exit code
        if (exitCode !== undefined) {
            if (exitCode === 0) {
                run.passed(test, 1000);
            } else {
                console.error(`Test failed with exit code ${exitCode}: ${result}`);
                run.failed(test, new Error(`Test failed with exit code ${exitCode}: ${result}`), 1000);
            }
        } else if (result.match(config.resultSuccessRgex)) {
            run.passed(test, 1000);
        } else {
            console.error(`Test failed: ${result}`);
            run.failed(test, new Error(`Test failed: ${result}`), 1000);
        }
        resolve();
    };
}



export async function loadDetailedCoverageHandler(testRun: vscode.TestRun, coverage: MarkdownFileCoverage | unknown): Promise<vscode.StatementCoverage[]> {
    if (coverage instanceof MarkdownFileCoverage) {
        return coverage.coveredLines.filter((l): l is vscode.StatementCoverage => !!l);
    }
    return [];
};
    

export function getTestListHandler(ctrl: vscode.TestController): (result: string) => void {
    const testListLineHandler = (line: string) => {
        // skip if line does not contain ','
        if (line.indexOf(',') === -1) {
            return;
        }
        const testCaseInfo = line.split(',');
        const fixtureTest = testCaseInfo[0];
        const _sourceFile = testCaseInfo[1];
        const _sourceLine = testCaseInfo[2];
        //const [fixture, test] = fixtureTest.split('::');
        // find last '::' and split
        // if not found fixture is empty '', test is fixtureTest
        const lastColon = fixtureTest.lastIndexOf('::');
        if (lastColon === -1) {
            var fixture = 'default';
            var test = fixtureTest;
        } else {
            var fixture = fixtureTest.slice(0, lastColon);
            var test = fixtureTest.slice(lastColon + 2);
        }
        fixture = fixture.trim();
        test = test.trim();
        var sourceFile = _sourceFile.trim();
        if (path.isAbsolute(sourceFile) === false) {
            const config = getConfigByController(ctrl);
            if (config && config.buildDirectory) {
                sourceFile = path.join(config.buildDirectory, sourceFile);
            } else {
                console.error('Config is undefined');
            }
        }
        // if sourceFile is not absolute path, make it absolute
        var sourceLine = _sourceLine.trim();
    
    
        //let fixtureTests = <TestSuiteInfo>testSuite.children.find(
        //    value => value.id == fixture
        //);
    
        let fixture_item = ctrl.items.get(fixture);
        if (!fixture_item) {
            let uri = vscode.Uri.file(sourceFile);
            fixture_item = ctrl.createTestItem(fixture, fixture, uri);
            fixture_item.canResolveChildren = true;
            ctrl.items.add(fixture_item);
        }
    
        let test_item = fixture_item?.children.get(fixtureTest);
        if (!test_item) {
            let uri = vscode.Uri.file(sourceFile);
            test_item = ctrl.createTestItem(fixtureTest, test, uri);
            test_item.range = new vscode.Range(parseInt(sourceLine) - 1, 0, parseInt(sourceLine) - 1, 0);
            fixture_item?.children.add(test_item);
        } else {
            test_item.range = new vscode.Range(parseInt(sourceLine) - 1, 0, parseInt(sourceLine) - 1, 0);
        }
    };

    return (result: string): void => {
        ctrl.items.replace([]);
        
        const lines = result.split('\n');
        lines.forEach(testListLineHandler);
    };
}

export async function getCTestDiscoveryHandler(ctrl: vscode.TestController, config: Config): Promise<void> {
    const buildType = config.cmakeBuildType || "";
    const parser = new CTestParser(config);
    const result = await parser.parse();
    
    if (result.errors.length > 0) {
        console.error('CTest parsing errors:', result.errors);
    }
    
    // Clear existing items
    ctrl.items.replace([]);
    
    // Group tests by fixture/suite
    const testsByFixture = new Map<string, CTestCase[]>();
    
    for (const test of result.tests) {
        let fixture = 'default';
        let testName = test.name;
        
        // Extract fixture and test name from test.name or test.testFullName
        const fullName = test.testFullName || test.name;
        const lastColon = fullName.lastIndexOf('::');
        
        if (lastColon !== -1) {
            fixture = fullName.slice(0, lastColon);
            testName = fullName.slice(lastColon + 2);
        }
        
        if (!testsByFixture.has(fixture)) {
            testsByFixture.set(fixture, []);
        }
        testsByFixture.get(fixture)!.push(test);
    }
    
    // Create test items
    for (const [fixtureName, tests] of testsByFixture) {
        let fixtureItem = ctrl.items.get(fixtureName);
        
        if (!fixtureItem) {
            // Use the first test's file as the fixture URI
            const firstTest = tests[0];
            const uri = firstTest.testFile 
                ? vscode.Uri.file(firstTest.testFile)
                : vscode.Uri.file(firstTest.executable);
                
            fixtureItem = ctrl.createTestItem(fixtureName, fixtureName, uri);
            fixtureItem.canResolveChildren = true;
            ctrl.items.add(fixtureItem);
        }
        
        for (const test of tests) {
            const fullTestId = test.testFullName || test.name;
            let testItem = fixtureItem.children.get(fullTestId);
            
            if (!testItem) {
                const uri = test.testFile 
                    ? vscode.Uri.file(test.testFile)
                    : vscode.Uri.file(test.executable);
                    
                const testLabel = fullTestId.includes('::') 
                    ? fullTestId.split('::').pop()! 
                    : test.name;
                    
                testItem = ctrl.createTestItem(fullTestId, testLabel, uri);
                
                if (test.testLine) {
                    testItem.range = new vscode.Range(
                        test.testLine - 1, 0, 
                        test.testLine - 1, 0
                    );
                }
                
                // Store CTest data for later use during test execution
                ctestDataMap.set(fullTestId, test);
                
                // Add test framework as a tag if available
                if (test.testFramework) {
                    testItem.tags = [new vscode.TestTag(test.testFramework)];
                }
                
                fixtureItem.children.add(testItem);
            }
        }
    }
}

export function getCTestDataForTest(testId: string): CTestCase | undefined {
    return ctestDataMap.get(testId);
}


