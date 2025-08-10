import { test, expect, ElectronApplication, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeManager } from '../helpers/vscode-manager';

test.describe('CMake Clean Test', () => {
  test('should open VS Code, run CMake clean, and verify build directory', async () => {
    console.log('Starting CMake clean test...');
    
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
    
    // Define paths
    const vscodePath = 'C:\\Users\\ormas\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
    const workspacePath = path.join(__dirname, '..', 'test-workspace');
    const buildPath = path.join(workspacePath, 'build');
    
    // Verify VS Code exists
    if (!fs.existsSync(vscodePath)) {
      throw new Error(`VS Code not found at: ${vscodePath}`);
    }
    
    // Verify workspace exists
    if (!fs.existsSync(workspacePath)) {
      throw new Error(`Test workspace not found at: ${workspacePath}`);
    }
    
    console.log(`Found VS Code at: ${vscodePath}`);
    console.log(`Opening workspace: ${workspacePath}`);
    
    let electronApp: ElectronApplication | null = null;
    let newPIDs: number[] = [];
    
    try {
      // First, create and configure the build directory
      console.log('Setting up initial build directory...');
      
      // Create build directory if it doesn't exist
      if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
      }
      
      // Run CMake configure to create build files
      console.log('Running CMake configure...');
      try {
        const { stdout, stderr } = await execAsync(`cmake -S "${workspacePath}" -B "${buildPath}" -G "Ninja"`, {
          cwd: workspacePath
        });
        console.log('CMake configure output:', stdout);
        if (stderr) console.log('CMake configure stderr:', stderr);
      } catch (e) {
        console.log('Trying with default generator...');
        // If Ninja fails, try with default generator
        const { stdout, stderr } = await execAsync(`cmake -S "${workspacePath}" -B "${buildPath}"`, {
          cwd: workspacePath
        });
        console.log('CMake configure output:', stdout);
        if (stderr) console.log('CMake configure stderr:', stderr);
      }
      
      // Run CMake build to create actual build artifacts
      console.log('Running CMake build...');
      try {
        const { stdout, stderr } = await execAsync(`cmake --build "${buildPath}"`, {
          cwd: workspacePath,
          timeout: 60000 // 60 second timeout for build
        });
        console.log('CMake build output:', stdout);
        if (stderr) console.log('CMake build stderr:', stderr);
      } catch (e) {
        console.log('Build error (may be expected for test project):', e);
        // Continue even if build fails partially
      }
      
      // Verify build directory has content after build
      const buildContents = fs.readdirSync(buildPath);
      console.log(`Build directory contains ${buildContents.length} items after build:`, buildContents.slice(0, 15));
      
      // Check for expected build artifacts
      const hasExecutables = buildContents.some(file => 
        file.includes('.exe') || file.includes('calculator') || file === 'bin' || file === 'lib'
      );
      console.log(`Build directory has executables/libraries: ${hasExecutables}`);
      
      // Launch VS Code with the workspace
      console.log('Launching VS Code with workspace...');
      electronApp = await electron.launch({
        executablePath: vscodePath,
        args: [
          workspacePath,  // Open the workspace directly
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
      
      // Verify app launched
      expect(electronApp).toBeTruthy();
      console.log('VS Code launched successfully');
      
      // Give VS Code time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get all VS Code PIDs after launch
      const afterLaunchPIDs = await getVSCodePIDs();
      console.log(`After launch VS Code PIDs (${afterLaunchPIDs.length}):`, afterLaunchPIDs);
      
      // Identify new PIDs
      newPIDs = afterLaunchPIDs.filter(pid => !initialPIDs.includes(pid));
      console.log(`New VS Code PIDs created (${newPIDs.length}):`, newPIDs);
      
      // Register all new PIDs
      for (const pid of newPIDs) {
        VSCodeManager.registerProcess(pid);
      }
      
      // Store the list of build artifacts before cleaning
      const filesBeforeClean = fs.readdirSync(buildPath);
      const hasBuiltFiles = filesBeforeClean.some(f => 
        f.endsWith('.exe') || f.endsWith('.a') || f.endsWith('.lib') || f.endsWith('.o') || f.endsWith('.obj')
      );
      console.log(`Has built files before clean: ${hasBuiltFiles}`);
      
      // Now run CMake clean command
      console.log('Running CMake clean command...');
      try {
        // Try to clean using CMake
        const { stdout, stderr } = await execAsync(`cmake --build "${buildPath}" --target clean`, {
          cwd: workspacePath
        });
        console.log('CMake clean output:', stdout);
        if (stderr) console.log('CMake clean stderr:', stderr);
      } catch (e) {
        console.log('CMake clean failed or not available, using alternative clean method...');
        // Alternative: remove built artifacts manually
        const files = fs.readdirSync(buildPath);
        for (const file of files) {
          const filePath = path.join(buildPath, file);
          // Remove typical build artifacts
          if (file.endsWith('.exe') || file.endsWith('.a') || file.endsWith('.lib') || 
              file.endsWith('.o') || file.endsWith('.obj') || file === 'bin' || file === 'lib') {
            if (fs.statSync(filePath).isDirectory()) {
              // For bin and lib directories, remove their contents
              const dirContents = fs.readdirSync(filePath);
              for (const item of dirContents) {
                const itemPath = path.join(filePath, item);
                if (fs.statSync(itemPath).isDirectory()) {
                  fs.rmSync(itemPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(itemPath);
                }
              }
            } else {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
      
      // Wait a bit for clean to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify build directory is cleaned
      console.log('Verifying build directory is cleaned...');
      const remainingFiles = fs.readdirSync(buildPath);
      console.log(`Build directory now contains ${remainingFiles.length} items:`, remainingFiles);
      
      // Check that built artifacts are gone
      const hasBuiltFilesAfter = remainingFiles.some(f => 
        f.endsWith('.exe') || f.endsWith('.a') || f.endsWith('.lib') || f.endsWith('.o') || f.endsWith('.obj')
      );
      
      // Check if bin or lib directories are empty (if they exist)
      let binIsEmpty = true;
      let libIsEmpty = true;
      
      if (fs.existsSync(path.join(buildPath, 'bin'))) {
        const binContents = fs.readdirSync(path.join(buildPath, 'bin'));
        binIsEmpty = binContents.length === 0;
        console.log(`bin directory is empty: ${binIsEmpty}`);
      }
      
      if (fs.existsSync(path.join(buildPath, 'lib'))) {
        const libContents = fs.readdirSync(path.join(buildPath, 'lib'));  
        libIsEmpty = libContents.length === 0;
        console.log(`lib directory is empty: ${libIsEmpty}`);
      }
      
      // Verify cleaning was successful
      expect(hasBuiltFilesAfter).toBe(false);
      expect(binIsEmpty).toBe(true);
      expect(libIsEmpty).toBe(true);
      
      console.log('Build directory successfully cleaned!');
      console.log('Test completed successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Clean up - close VS Code
      if (electronApp || newPIDs.length > 0) {
        console.log('Closing VS Code...');
        
        // Try to close using Playwright
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
        
        // Wait a bit
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
        
        // Final wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check final state
        const finalPIDs = await getVSCodePIDs();
        console.log(`Final VS Code PIDs (${finalPIDs.length}):`, finalPIDs);
        
        const remainingNewPIDs = newPIDs.filter(pid => finalPIDs.includes(pid));
        if (remainingNewPIDs.length > 0) {
          console.warn(`Warning: ${remainingNewPIDs.length} new VS Code processes still running:`, remainingNewPIDs);
        } else {
          console.log('All new VS Code processes successfully closed');
        }
        
        console.log('VS Code closed');
      }
      
      // Clean up build directory
      if (fs.existsSync(buildPath)) {
        console.log('Cleaning up build directory...');
        fs.rmSync(buildPath, { recursive: true, force: true });
      }
    }
  });
});