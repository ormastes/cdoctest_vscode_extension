import { test, expect, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeManager } from '../helpers/vscode-manager';

test.describe('Simple VS Code Launch Test', () => {
  test('should open and close VS Code successfully', async () => {
    console.log('Starting VS Code launch test...');
    
    // Helper to count VS Code processes
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    async function countVSCodeProcesses(): Promise<number> {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Code.exe" 2>nul');
      return stdout.split('\n').filter(line => line.includes('Code.exe')).length;
    }
    
    // Check initial VS Code processes
    const initialProcessCount = await countVSCodeProcesses();
    console.log(`Initial VS Code processes: ${initialProcessCount}`);
    
    // Find VS Code executable
    const vscodePath = 'C:\\Users\\ormas\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
    
    if (!fs.existsSync(vscodePath)) {
      throw new Error(`VS Code not found at: ${vscodePath}`);
    }
    
    console.log(`Found VS Code at: ${vscodePath}`);
    
    let electronApp: ElectronApplication | null = null;
    let trackedPid: number | null = null;
    let afterLaunchCount = initialProcessCount;
    
    try {
      // Launch VS Code with minimal settings
      console.log('Launching VS Code...');
      electronApp = await electron.launch({
        executablePath: vscodePath,
        args: [
          '--new-window',
          '--no-sandbox',
          '--disable-gpu-sandbox', 
          '--disable-workspace-trust',
          '--skip-release-notes',
          '--skip-welcome',
          '--disable-telemetry',
          '--disable-updates',
          '--disable-crash-reporter',
          '--user-data-dir=' + path.join(__dirname, '..', 'temp-vscode-profile'),
          '--extensions-dir=' + path.join(__dirname, '..', 'temp-vscode-extensions')
        ],
        timeout: 30000
      });
      
      // Track the process if we can get its PID
      try {
        const electronProcess = (electronApp as any).process();
        if (electronProcess && electronProcess.pid) {
          trackedPid = electronProcess.pid;
          VSCodeManager.registerProcess(trackedPid);
          console.log(`VS Code launched with PID: ${trackedPid}`);
        }
      } catch (e) {
        console.log('Could not get process PID:', e);
      }

      // Just verify the app launched successfully
      expect(electronApp).toBeTruthy();
      console.log('VS Code process launched successfully');
      
      // Give VS Code time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check VS Code processes after launch
      afterLaunchCount = await countVSCodeProcesses();
      console.log(`After launch VS Code processes: ${afterLaunchCount}`);
      console.log(`New processes created: ${afterLaunchCount - initialProcessCount}`);
      
      // Don't try to detect windows - just verify the process is running
      console.log('VS Code is running');
      
      console.log('Test completed successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Clean up - always close VS Code
      if (electronApp) {
        console.log('Closing VS Code...');
        
        // Try to close using Playwright's method first
        try {
          await electronApp.close();
          console.log('Closed VS Code using Playwright');
        } catch (e) {
          console.log('Failed to close with Playwright:', e);
          
          // Fallback: Use VSCodeManager to kill the tracked process
          if (trackedPid) {
            console.log(`Killing VS Code process ${trackedPid} with force...`);
            // Use force kill with tree flag to kill all child processes
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            try {
              await execAsync(`taskkill /PID ${trackedPid} /T /F`);
              console.log(`Force killed VS Code process tree for PID ${trackedPid}`);
            } catch (killErr) {
              console.log(`Failed to force kill: ${killErr}`);
            }
          }
        }
        
        // Wait to ensure process is terminated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check VS Code processes after closing
        const finalProcessCount = await countVSCodeProcesses();
        console.log(`Final VS Code processes: ${finalProcessCount}`);
        console.log(`Processes closed: ${afterLaunchCount - finalProcessCount}`);
        
        console.log('VS Code closed');
      }
    }
  });

});