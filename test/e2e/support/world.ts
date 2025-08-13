import { setWorldConstructor, World, BeforeAll, AfterAll, Before, After } from '@cucumber/cucumber';
import { VSBrowser } from 'vscode-extension-tester';
import { StatusManager } from '../lib/status-manager';
import * as path from 'path';

// Custom World class for vscode-extension-tester
class VSCodeWorld extends World {
    public statusManager: StatusManager;
    public browser?: VSBrowser;
    
    constructor(options: any) {
        super(options);
        this.statusManager = new StatusManager();
    }
}

// Set the custom world
setWorldConstructor(VSCodeWorld);

let globalStatusManager: StatusManager;

// Global hooks
BeforeAll({ timeout: 120000 }, async function() {
    console.log('Setting up VSCode Extension Tester...');
    
    const workspacePath = path.resolve(process.cwd(), 'test', 'integrated_unit_gtest_and_cdoctest_cmake_ctest');
    
    globalStatusManager = new StatusManager();
    await globalStatusManager.setupVSCode(workspacePath);
    
    console.log('VSCode Extension Tester setup complete');
});

Before({ timeout: 60000 }, async function(this: VSCodeWorld) {
    console.log('Starting VSCode instance for test...');
    
    const workspacePath = path.resolve(process.cwd(), 'test', 'integrated_unit_gtest_and_cdoctest_cmake_ctest');
    const testFiles = [path.resolve(process.cwd(), 'out', 'test', 'e2e', 'cucumber-runner.js')];
    
    this.statusManager = globalStatusManager;
    await this.statusManager.launchVSCode(testFiles, workspacePath);
    
    this.browser = this.statusManager.getBrowser();
    if (this.browser) {
        await this.browser.waitForWorkbench();
    }
    
    console.log('VSCode instance started');
});

After({ timeout: 30000 }, async function(this: VSCodeWorld) {
    console.log('Cleaning up after test...');
    
    // Status manager will handle proper cleanup
    const cleanedUp = await this.statusManager.closeVSCode();
    
    if (!cleanedUp) {
        console.error('VSCode did not close cleanly');
    }
    
    console.log('Cleanup complete');
});

AfterAll({ timeout: 30000 }, async function() {
    console.log('All tests completed, final cleanup...');
    
    if (globalStatusManager) {
        await globalStatusManager.cleanup();
    }
    
    console.log('Final cleanup complete');
});