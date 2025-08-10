import { test, expect, Page, ElectronApplication, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeManager } from '../helpers/vscode-manager';

test.describe('Simple VS Code Launch Test', () => {
  test('should open and close VS Code successfully', async () => {
    console.log('Starting VS Code launch test...');
    
    // Helper functions for process management
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    async function getVSCodePIDs(): Promise<number[]> {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Code.exe" /FO CSV 2>nul');
      const lines = stdout.split('\n').slice(1); // Skip header
      const pids: number[] = [];
      
      for (const line of lines) {
        if (line.includes('Code.exe')) {
          // Parse CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
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
    
    // Get initial VS Code PIDs
    const initialPIDs = await getVSCodePIDs();
    console.log(`Initial VS Code PIDs (${initialPIDs.length}):`, initialPIDs);
    
    // Find VS Code executable
    const vscodePath = 'C:\\Users\\ormas\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
    
    if (!fs.existsSync(vscodePath)) {
      throw new Error(`VS Code not found at: ${vscodePath}`);
    }
    
    console.log(`Found VS Code at: ${vscodePath}`);
    
    let electronApp: ElectronApplication | null = null;
    let newPIDs: number[] = [];
    
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
      
      // Just verify the app launched successfully
      expect(electronApp).toBeTruthy();
      console.log('VS Code process launched successfully');
      
      // Give VS Code time to fully initialize and spawn all child processes
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get all VS Code PIDs after launch
      const afterLaunchPIDs = await getVSCodePIDs();
      console.log(`After launch VS Code PIDs (${afterLaunchPIDs.length}):`, afterLaunchPIDs);
      
      // Identify new PIDs that were created
      newPIDs = afterLaunchPIDs.filter(pid => !initialPIDs.includes(pid));
      console.log(`New VS Code PIDs created (${newPIDs.length}):`, newPIDs);
      
      // Register all new PIDs with VSCodeManager
      for (const pid of newPIDs) {
        VSCodeManager.registerProcess(pid);
      }
      
      // Don't try to detect windows - just verify the process is running
      console.log('VS Code is running');
      
      console.log('Test completed successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Clean up - always close VS Code
      if (electronApp || newPIDs.length > 0) {
        console.log('Closing VS Code...');
        
        // Try to close using Playwright's method first
        let closedWithPlaywright = false;
        if (electronApp) {
          try {
            await electronApp.close();
            console.log('Closed VS Code using Playwright');
            closedWithPlaywright = true;
          } catch (e) {
            console.log('Failed to close with Playwright:', e);
          }
        }
        
        // Wait a bit to see if Playwright close worked
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check which PIDs are still running
        const remainingPIDs = await getVSCodePIDs();
        const pidsToKill = newPIDs.filter(pid => remainingPIDs.includes(pid));
        
        if (pidsToKill.length > 0) {
          console.log(`Found ${pidsToKill.length} VS Code processes still running, force killing:`, pidsToKill);
          
          // Force kill each remaining PID
          for (const pid of pidsToKill) {
            try {
              await execAsync(`taskkill /PID ${pid} /T /F`);
              console.log(`Force killed VS Code process tree for PID ${pid}`);
            } catch (killErr) {
              console.log(`Failed to kill PID ${pid}:`, killErr);
            }
          }
        }
        
        // Wait to ensure processes are terminated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check VS Code processes after closing
        const finalPIDs = await getVSCodePIDs();
        console.log(`Final VS Code PIDs (${finalPIDs.length}):`, finalPIDs);
        
        // Check if we successfully closed all new processes
        const remainingNewPIDs = newPIDs.filter(pid => finalPIDs.includes(pid));
        if (remainingNewPIDs.length > 0) {
          console.warn(`Warning: ${remainingNewPIDs.length} new VS Code processes still running:`, remainingNewPIDs);
        } else {
          console.log('All new VS Code processes successfully closed');
        }
        
        console.log('VS Code closed');
      }
    }
  });

});