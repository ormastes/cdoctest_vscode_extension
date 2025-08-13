import { StatusManager } from './lib/status-manager';
import * as path from 'path';
import { spawn } from 'child_process';

async function runE2ETests() {
    console.log('Starting E2E Tests with StatusManager...');
    
    const workspacePath = path.resolve(process.cwd(), 'test', 'integrated_unit_gtest_and_cdoctest_cmake_ctest');
    const statusManager = new StatusManager();
    
    try {
        // Setup VSCode and extension
        await statusManager.setupVSCode(workspacePath);
        
        // Prepare test files for VSCode to run
        const testFiles = [
            path.resolve(process.cwd(), 'out', 'test', 'e2e', 'vscode-cucumber-runner.js')
        ];
        
        // Launch VSCode with the workspace and run tests inside it
        console.log('Launching VSCode with workspace and running tests...');
        await statusManager.launchVSCode(testFiles, workspacePath);
        
        // Note: The tests will run inside VSCode and exit when done
        // The launchVSCode method handles the test execution
        
        // Cleanup and verify
        await statusManager.cleanup();
        
        console.log('All E2E tests completed successfully!');
        
    } catch (error) {
        console.error('E2E test execution failed:', error);
        await statusManager.cleanup();
        process.exit(1);
    }
}

// Run if this is the main module
if (require.main === module) {
    runE2ETests();
}