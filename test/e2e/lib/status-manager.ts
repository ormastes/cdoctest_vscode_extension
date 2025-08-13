const psList = require('ps-list');
import { ExTester, VSBrowser } from 'vscode-extension-tester';
import * as path from 'path';

export type PidSnapshot = Set<number>;

export interface ProcessDescriptor {
    pid: number;
    name?: string;
    cmd?: string;
}

export interface VscodePidOptions {
    // Customize how to classify a "VS Code" process
    match?: (p: ProcessDescriptor) => boolean;
}

const defaultMatch = (p: ProcessDescriptor) => {
    const n = (p.name || '').toLowerCase();
    const c = (p.cmd || '').toLowerCase();
    // Cover typical names across platforms and insiders
    return (
        n.includes('code') ||
        (n.includes('electron') && c.includes('code')) ||
        c.includes('visual studio code') ||
        c.includes('code - insiders') ||
        c.includes('code.exe') ||
        c.includes('code-insiders')
    );
};

export class StatusManager {
    private tester?: ExTester;
    private browser?: VSBrowser;
    private beforePids: PidSnapshot = new Set();
    private launchedPids: PidSnapshot = new Set();
    private storagePath: string;
    private extensionPath: string;

    constructor(storagePath?: string, extensionPath?: string) {
        this.storagePath = storagePath || path.resolve(process.cwd(), 'test', 'e2e', '.test-extensions');
        this.extensionPath = extensionPath || process.cwd();
    }

    async getVSCodePids(opts?: VscodePidOptions): Promise<PidSnapshot> {
        const list = await psList.default();
        const match = opts?.match ?? defaultMatch;
        return new Set(list.filter((p: ProcessDescriptor) => match(p)).map((p: ProcessDescriptor) => p.pid));
    }

    diffPids(before: PidSnapshot, after: PidSnapshot) {
        const added = new Set<number>([...after].filter(pid => !before.has(pid)));
        const removed = new Set<number>([...before].filter(pid => !after.has(pid)));
        return { added, removed };
    }

    async waitForNewVSCodePids(
        baseline: PidSnapshot,
        timeoutMs = 30000,
        pollMs = 500,
        opts?: VscodePidOptions
    ): Promise<Set<number>> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const now = await this.getVSCodePids(opts);
            const { added } = this.diffPids(baseline, now);
            if (added.size > 0) return added;
            await new Promise(r => setTimeout(r, pollMs));
        }
        return new Set();
    }

    async waitForPidsExit(
        pids: Set<number>,
        timeoutMs = 30000,
        pollMs = 500
    ): Promise<boolean> {
        const start = Date.now();
        const stillAlive = async () => {
            const now = await psList.default();
            const alive = new Set(now.map((p: ProcessDescriptor) => p.pid));
            return [...pids].some(pid => alive.has(pid));
        };
        while (Date.now() - start < timeoutMs) {
            if (!(await stillAlive())) return true;
            await new Promise(r => setTimeout(r, pollMs));
        }
        return false;
    }

    async setupVSCode(workspacePath?: string): Promise<void> {
        console.log('Setting up VSCode Extension Tester...');
        
        // Capture baseline PIDs
        this.beforePids = await this.getVSCodePids();
        console.log(`Baseline: ${this.beforePids.size} VS Code processes already running`);

        // Change to extension root directory for proper manifest detection
        process.chdir(this.extensionPath);

        // Create tester instance
        this.tester = new ExTester(this.storagePath);

        // Download VSCode and ChromeDriver if needed
        console.log('Downloading VSCode and ChromeDriver...');
        await this.tester.downloadCode();
        await this.tester.downloadChromeDriver();

        // Setup requirements
        console.log('Setting up requirements...');
        await this.tester.setupRequirements();

        // Install the extension
        console.log('Installing extension...');
        await this.tester.installVsix();

        // Install dependencies
        console.log('Installing extension dependencies...');
        await this.tester.installFromMarketplace('ms-vscode.cmake-tools');
        await this.tester.installFromMarketplace('llvm-vs-code-extensions.lldb-dap');
    }

    async launchVSCode(
        testFiles: string[],
        workspacePath?: string,
        settings?: Record<string, any>
    ): Promise<void> {
        if (!this.tester) {
            throw new Error('VSCode not set up. Call setupVSCode() first.');
        }

        const defaultSettings = {
            'workbench.startupEditor': 'none',
            'extensions.autoUpdate': false,
            'extensions.autoCheckUpdates': false,
            'telemetry.telemetryLevel': 'off',
            'update.mode': 'none',
            'cdoctest.enableCdoctestConfig': true,
            'cdoctest.enableExeConfig': true,
            'cdoctest.enableBinConfig': true,
            'cdoctest.enableCmakeConfig': true,
            'cdoctest.useCmakeTarget': true
        };

        const options: any = {
            settings: { ...defaultSettings, ...settings }
        };

        if (workspacePath) {
            options.workspaceFolders = [workspacePath];
        }

        console.log('Launching VSCode with tests...');
        
        // Start monitoring for new PIDs
        const newPidsPromise = this.waitForNewVSCodePids(this.beforePids, 30000);

        // Launch VSCode with tests
        await this.tester.setupAndRunTests(testFiles, undefined, options);

        // Capture launched PIDs
        this.launchedPids = await newPidsPromise;
        
        if (this.launchedPids.size > 0) {
            console.log(`VSCode launched with ${this.launchedPids.size} new processes: ${[...this.launchedPids].join(', ')}`);
        } else {
            console.warn('Warning: No new VSCode processes detected');
        }

        // Get browser instance
        this.browser = VSBrowser.instance;
    }

    async closeVSCode(): Promise<boolean> {
        console.log('Closing VSCode...');
        
        if (this.browser) {
            try {
                await this.browser.quit();
            } catch (error) {
                console.error('Error closing browser:', error);
            }
        }

        // Wait for launched PIDs to exit
        if (this.launchedPids.size > 0) {
            const closed = await this.waitForPidsExit(this.launchedPids, 30000);
            if (!closed) {
                console.error(`VSCode did not close cleanly. PIDs still running: ${[...this.launchedPids].join(', ')}`);
                return false;
            } else {
                console.log('VSCode closed successfully');
                return true;
            }
        }
        
        return true;
    }

    async cleanup(): Promise<void> {
        await this.closeVSCode();
        
        const afterPids = await this.getVSCodePids();
        const { added } = this.diffPids(this.beforePids, afterPids);
        
        if (added.size > 0) {
            console.warn(`Warning: ${added.size} VS Code processes were left running: ${[...added].join(', ')}`);
        }
    }

    getBrowser(): VSBrowser | undefined {
        return this.browser;
    }

    getTester(): ExTester | undefined {
        return this.tester;
    }

    getLaunchedPids(): PidSnapshot {
        return this.launchedPids;
    }
}