import { ElectronApplication, _electron as electron, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { VSCodeManager } from './vscode-manager';

const execAsync = promisify(exec);

export interface VSCodeTestConfig {
  vscodePath?: string;
  workspacePath?: string;
  buildPath?: string;
  userDataDir?: string;
  extensionsDir?: string;
  additionalArgs?: string[];
  initTimeout?: number;
  cleanupBuildDir?: boolean;
}

export interface CMakeConfig {
  sourceDir: string;
  buildDir: string;
  generator?: string;
  buildTimeout?: number;
}

export interface TestResult {
  success: boolean;
  message?: string;
  data?: any;
}

export class VSCodeTestHelper {
  private electronApp: ElectronApplication | null = null;
  private initialPIDs: number[] = [];
  private newPIDs: number[] = [];
  private config: VSCodeTestConfig;
  private defaultVSCodePath = 'C:\\Users\\ormas\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';

  constructor(config: VSCodeTestConfig = {}) {
    this.config = {
      vscodePath: config.vscodePath || this.defaultVSCodePath,
      workspacePath: config.workspacePath || path.join(__dirname, '..', 'test-workspace'),
      buildPath: config.buildPath || path.join(config.workspacePath || path.join(__dirname, '..', 'test-workspace'), 'build'),
      userDataDir: config.userDataDir || path.join(__dirname, '..', 'temp-vscode-profile'),
      // Only set extensionsDir if explicitly provided
      extensionsDir: config.extensionsDir,
      additionalArgs: config.additionalArgs || [],
      initTimeout: config.initTimeout || 5000,
      cleanupBuildDir: config.cleanupBuildDir !== false
    };
  }

  /**
   * Get all VS Code process PIDs
   */
  async getVSCodePIDs(): Promise<number[]> {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Code.exe" /FO CSV 2>nul');
    const lines = stdout.split('\n').slice(1); // Skip header
    const pids: number[] = [];
    
    for (const line of lines) {
      if (line.includes('Code.exe')) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parseInt(parts[1].replace(/"/g, '').trim());
          if (!isNaN(pid)) {
            pids.push(pid);
          }
        }
      }
    }
    return pids;
  }

  /**
   * Initialize test environment and capture initial state
   */
  async initialize(): Promise<TestResult> {
    console.log('Initializing VS Code test environment...');
    
    // Capture initial PIDs
    this.initialPIDs = await this.getVSCodePIDs();
    console.log(`Initial VS Code PIDs (${this.initialPIDs.length}):`, this.initialPIDs);
    
    // Verify VS Code exists
    if (!fs.existsSync(this.config.vscodePath!)) {
      return {
        success: false,
        message: `VS Code not found at: ${this.config.vscodePath}`
      };
    }
    
    // Verify workspace exists
    if (this.config.workspacePath && !fs.existsSync(this.config.workspacePath)) {
      return {
        success: false,
        message: `Workspace not found at: ${this.config.workspacePath}`
      };
    }
    
    console.log(`Found VS Code at: ${this.config.vscodePath}`);
    if (this.config.workspacePath) {
      console.log(`Using workspace: ${this.config.workspacePath}`);
    }
    
    return { success: true };
  }

  /**
   * Launch VS Code with the configured settings
   */
  async launchVSCode(): Promise<TestResult> {
    console.log('Launching VS Code...');
    
    const args = [
      '--new-window',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--disable-workspace-trust',
      '--skip-release-notes',
      '--skip-welcome',
      '--disable-telemetry',
      '--disable-updates',
      '--disable-crash-reporter',
      `--user-data-dir=${this.config.userDataDir}`,
      ...this.config.additionalArgs!
    ];
    
    // Only add extensions-dir if explicitly provided
    if (this.config.extensionsDir) {
      args.push(`--extensions-dir=${this.config.extensionsDir}`);
    }
    
    // Add workspace path if provided
    if (this.config.workspacePath) {
      args.unshift(this.config.workspacePath);
    }
    
    try {
      this.electronApp = await electron.launch({
        executablePath: this.config.vscodePath!,
        args: args,
        timeout: 30000
      });
      
      if (!this.electronApp) {
        return { success: false, message: 'Failed to launch VS Code' };
      }
      
      console.log('VS Code launched successfully');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, this.config.initTimeout));
      
      // Capture new PIDs
      const afterLaunchPIDs = await this.getVSCodePIDs();
      this.newPIDs = afterLaunchPIDs.filter(pid => !this.initialPIDs.includes(pid));
      console.log(`New VS Code PIDs created (${this.newPIDs.length}):`, this.newPIDs);
      
      // Register new PIDs for tracking
      for (const pid of this.newPIDs) {
        VSCodeManager.registerProcess(pid);
      }
      
      return { 
        success: true, 
        data: { 
          pids: this.newPIDs,
          app: this.electronApp 
        } 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: `Failed to launch VS Code: ${error.message}` 
      };
    }
  }

  /**
   * Close VS Code and clean up processes
   */
  async closeVSCode(): Promise<TestResult> {
    console.log('Closing VS Code...');
    
    let closedWithPlaywright = false;
    
    // Try to close using Playwright
    if (this.electronApp) {
      try {
        await this.electronApp.close();
        console.log('Closed VS Code using Playwright');
        closedWithPlaywright = true;
      } catch (e) {
        console.log('Failed to close with Playwright:', e);
      }
    }
    
    // Wait a bit to see if Playwright close worked
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check which PIDs are still running
    const remainingPIDs = await this.getVSCodePIDs();
    const pidsToKill = this.newPIDs.filter(pid => remainingPIDs.includes(pid));
    
    if (pidsToKill.length > 0) {
      console.log(`Found ${pidsToKill.length} VS Code processes still running, force killing:`, pidsToKill);
      
      for (const pid of pidsToKill) {
        try {
          await execAsync(`taskkill /PID ${pid} /T /F`);
          console.log(`Force killed VS Code process tree for PID ${pid}`);
        } catch (killErr) {
          console.log(`Failed to kill PID ${pid}:`, killErr);
        }
      }
    }
    
    // Final wait
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check final state
    const finalPIDs = await this.getVSCodePIDs();
    const remainingNewPIDs = this.newPIDs.filter(pid => finalPIDs.includes(pid));
    
    if (remainingNewPIDs.length > 0) {
      console.warn(`Warning: ${remainingNewPIDs.length} new VS Code processes still running:`, remainingNewPIDs);
      return {
        success: false,
        message: `Failed to close all VS Code processes. ${remainingNewPIDs.length} still running.`
      };
    }
    
    console.log('All new VS Code processes successfully closed');
    return { success: true };
  }

  /**
   * Clean up build directory if configured
   */
  async cleanup(): Promise<void> {
    if (this.config.cleanupBuildDir && this.config.buildPath && fs.existsSync(this.config.buildPath)) {
      console.log('Cleaning up build directory...');
      fs.rmSync(this.config.buildPath, { recursive: true, force: true });
    }
  }

  /**
   * Configure CMake project
   */
  async cmakeConfigure(config: CMakeConfig): Promise<TestResult> {
    console.log('Running CMake configure...');
    
    // Create build directory if it doesn't exist
    if (!fs.existsSync(config.buildDir)) {
      fs.mkdirSync(config.buildDir, { recursive: true });
    }
    
    try {
      let command = `cmake -S "${config.sourceDir}" -B "${config.buildDir}"`;
      if (config.generator) {
        command += ` -G "${config.generator}"`;
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: config.sourceDir
      });
      
      console.log('CMake configure successful');
      if (stderr && !stderr.includes('Warning')) {
        console.log('Configure stderr:', stderr);
      }
      
      return { success: true, data: { stdout, stderr } };
    } catch (error: any) {
      // Try without generator if it failed with one
      if (config.generator) {
        console.log('Trying with default generator...');
        try {
          const { stdout, stderr } = await execAsync(
            `cmake -S "${config.sourceDir}" -B "${config.buildDir}"`,
            { cwd: config.sourceDir }
          );
          console.log('CMake configure successful with default generator');
          return { success: true, data: { stdout, stderr } };
        } catch (fallbackError: any) {
          return { 
            success: false, 
            message: `CMake configure failed: ${fallbackError.message}` 
          };
        }
      }
      
      return { 
        success: false, 
        message: `CMake configure failed: ${error.message}` 
      };
    }
  }

  /**
   * Build CMake project
   */
  async cmakeBuild(buildDir: string, timeout: number = 60000): Promise<TestResult> {
    console.log('Running CMake build...');
    
    try {
      const { stdout, stderr } = await execAsync(`cmake --build "${buildDir}"`, {
        cwd: buildDir,
        timeout: timeout
      });
      
      console.log('Build completed successfully');
      return { success: true, data: { stdout, stderr } };
    } catch (error: any) {
      console.log('Build error:', error.message);
      return { 
        success: false, 
        message: `Build failed: ${error.message}`,
        data: { stdout: error.stdout, stderr: error.stderr }
      };
    }
  }

  /**
   * Clean CMake build
   */
  async cmakeClean(buildDir: string): Promise<TestResult> {
    console.log('Running CMake clean...');
    
    try {
      const { stdout, stderr } = await execAsync(`cmake --build "${buildDir}" --target clean`, {
        cwd: buildDir
      });
      
      console.log('Clean completed successfully');
      return { success: true, data: { stdout, stderr } };
    } catch (error: any) {
      console.log('Clean failed, using manual cleanup...');
      
      // Manual cleanup
      const files = fs.readdirSync(buildDir);
      for (const file of files) {
        const filePath = path.join(buildDir, file);
        if (file.endsWith('.exe') || file.endsWith('.a') || file.endsWith('.lib') || 
            file.endsWith('.o') || file.endsWith('.obj')) {
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      }
      
      return { success: true, message: 'Manual cleanup performed' };
    }
  }

  /**
   * Run CTest
   */
  async runCTest(buildDir: string): Promise<TestResult> {
    console.log('Running CTest...');
    
    try {
      const { stdout, stderr } = await execAsync(
        `ctest --test-dir "${buildDir}" --output-on-failure`,
        { cwd: buildDir, timeout: 30000 }
      );
      
      console.log('CTest output:', stdout);
      
      const testsRan = stdout.includes('Test #') || 
                      stdout.includes('tests passed') || 
                      stdout.includes('% tests passed');
      
      return { 
        success: testsRan, 
        data: { stdout, stderr, testsRan } 
      };
    } catch (error: any) {
      // Even if tests fail, check if they ran
      if (error.stdout) {
        const testsRan = error.stdout.includes('Test #') || 
                        error.stdout.includes('% tests passed');
        return { 
          success: testsRan, 
          message: 'Tests ran with failures',
          data: { stdout: error.stdout, stderr: error.stderr, testsRan } 
        };
      }
      
      return { 
        success: false, 
        message: `CTest failed: ${error.message}` 
      };
    }
  }

  /**
   * Verify build artifacts exist
   */
  verifyBuildArtifacts(buildDir: string): TestResult {
    // Check main directory and common subdirectories
    const dirsToCheck = [buildDir];
    const subdirs = ['bin', 'lib', 'Debug', 'Release', 'MinSizeRel', 'RelWithDebInfo'];
    
    for (const subdir of subdirs) {
      const fullPath = path.join(buildDir, subdir);
      if (fs.existsSync(fullPath)) {
        dirsToCheck.push(fullPath);
      }
    }
    
    let allFiles: string[] = [];
    let hasArtifacts = false;
    
    for (const dir of dirsToCheck) {
      try {
        const files = fs.readdirSync(dir);
        allFiles = allFiles.concat(files.map(f => path.relative(buildDir, path.join(dir, f))));
        
        if (files.some(f => 
          f.endsWith('.exe') || f.endsWith('.a') || f.endsWith('.lib') || 
          f.endsWith('.o') || f.endsWith('.obj') || f.endsWith('.dll')
        )) {
          hasArtifacts = true;
        }
      } catch (e) {
        // Directory might not exist
      }
    }
    
    return {
      success: hasArtifacts,
      data: { files: allFiles, hasArtifacts, dirsChecked: dirsToCheck }
    };
  }

  /**
   * Get the main VS Code window/page
   */
  async getMainWindow(): Promise<Page | null> {
    if (!this.electronApp) {
      console.log('No Electron app instance');
      return null;
    }
    
    try {
      // Get the first window (main window)
      const windows = await this.electronApp.windows();
      if (windows.length > 0) {
        console.log(`Found ${windows.length} VS Code window(s)`);
        return windows[0];
      }
      console.log('No VS Code windows found');
      return null;
    } catch (error: any) {
      console.error('Failed to get VS Code window:', error);
      return null;
    }
  }

  /**
   * Wait for element and click it
   */
  async clickElement(page: Page, selector: string, timeout: number = 10000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      console.log(`Clicked element: ${selector}`);
      return true;
    } catch (error) {
      console.error(`Failed to click element ${selector}:`, error);
      return false;
    }
  }

  /**
   * Check if element exists
   */
  async elementExists(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get text content from element
   */
  async getElementText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.textContent();
      }
      return null;
    } catch (error) {
      console.error(`Failed to get text from ${selector}:`, error);
      return null;
    }
  }

  /**
   * Get all matching elements' text
   */
  async getAllElementsText(page: Page, selector: string): Promise<string[]> {
    try {
      const elements = await page.$$(selector);
      const texts: string[] = [];
      for (const element of elements) {
        const text = await element.textContent();
        if (text) {
          texts.push(text.trim());
        }
      }
      return texts;
    } catch (error) {
      console.error(`Failed to get texts from ${selector}:`, error);
      return [];
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(page: Page, name: string): Promise<void> {
    try {
      const screenshotPath = path.join(__dirname, '..', 'screenshots', `${name}.png`);
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await page.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }

  /**
   * Verify CTest files
   */
  verifyCTestFiles(buildDir: string): TestResult {
    const ctestFilePath = path.join(buildDir, 'CTestTestfile.cmake');
    const exists = fs.existsSync(ctestFilePath);
    
    if (!exists) {
      return { success: false, message: 'CTestTestfile.cmake not found' };
    }
    
    const content = fs.readFileSync(ctestFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const hasTestDefinitions = content.includes('add_test') || 
                              content.includes('ADD_TEST') ||
                              content.includes('subdirs') ||
                              content.includes('SUBDIRS');
    
    return {
      success: lines.length > 3 && hasTestDefinitions,
      data: {
        exists,
        lineCount: lines.length,
        hasTestDefinitions,
        firstFewLines: lines.slice(0, 5)
      }
    };
  }
}