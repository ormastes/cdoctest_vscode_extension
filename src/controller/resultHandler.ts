import * as vscode from 'vscode';
import { Config } from '../config';
import { MarkdownFileCoverage } from '../coverage';

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
        var sourceLine = _sourceLine.trim();
    
    
        //let fixtureTests = <TestSuiteInfo>testSuite.children.find(
        //    value => value.id == fixture
        //);
        let root_item = ctrl.items.get('root-suite');
        if (!root_item) {
            root_item = ctrl.createTestItem('root-suite', 'CPP Executable Test');
            root_item.canResolveChildren = true;
            ctrl.items.add(root_item);
        }
    
        let fixture_item = root_item?.children.get(fixture);
        if (!fixture_item) {
            let uri = vscode.Uri.file(sourceFile);
            fixture_item = ctrl.createTestItem(fixture, fixture, uri);
            fixture_item.canResolveChildren = true;
            root_item?.children.add(fixture_item);
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
    let root_item = ctrl.items.get('root-suite');
    if (!root_item) {
        root_item = ctrl.createTestItem('root-suite', 'CPP Executable Test');
        root_item.canResolveChildren = true;
        ctrl.items.add(root_item);
    }
    const childIds: string[] = [];
    root_item.children.forEach(item => {
        childIds.push(item.id);
    });

    // Then, delete each child by its ID
    childIds.forEach(id => {
        root_item.children.delete(id);
    });
    const lines = result.split('\n');
    lines.forEach(testListLineHandler);
};
}

