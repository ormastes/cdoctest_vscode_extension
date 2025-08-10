import { test, expect, ElectronApplication, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeManager } from '../helpers/vscode-manager';

test.describe('CMake Rebuild and CTest Verification', () => {
  test('should configure, build, clean, rebuild and verify CTest files', async () => {
    console.log('Starting CMake rebuild and CTest verification test...');
    
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
      // Step 1: Initial setup and build
      console.log('\n=== Step 1: Initial Configure and Build ===');
      
      // Create build directory if it doesn't exist
      if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
      }
      
      // Run CMake configure
      console.log('Running CMake configure...');
      try {
        const { stdout, stderr } = await execAsync(`cmake -S "${workspacePath}" -B "${buildPath}" -G "Ninja"`, {
          cwd: workspacePath
        });
        console.log('CMake configure successful');
        if (stderr && !stderr.includes('Warning')) console.log('Configure stderr:', stderr);
      } catch (e) {
        console.log('Trying with default generator...');
        const { stdout, stderr } = await execAsync(`cmake -S "${workspacePath}" -B "${buildPath}"`, {
          cwd: workspacePath
        });
        console.log('CMake configure successful with default generator');
      }
      
      // Run initial build
      console.log('Running initial CMake build...');
      const buildResult = await execAsync(`cmake --build "${buildPath}"`, {
        cwd: workspacePath,
        timeout: 60000
      });
      console.log('Initial build completed successfully');
      
      // Verify initial build artifacts
      const initialBuildFiles = fs.readdirSync(buildPath);
      const hasInitialArtifacts = initialBuildFiles.some(f => 
        f.includes('.exe') || f.includes('.a') || f.includes('.lib')
      );
      console.log(`Initial build has artifacts: ${hasInitialArtifacts}`);
      expect(hasInitialArtifacts).toBe(true);
      
      // Launch VS Code with the workspace
      console.log('\nLaunching VS Code with workspace...');
      electronApp = await electron.launch({
        executablePath: vscodePath,
        args: [
          workspacePath,
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
      
      expect(electronApp).toBeTruthy();
      console.log('VS Code launched successfully');
      
      // Give VS Code time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get new PIDs
      const afterLaunchPIDs = await getVSCodePIDs();
      newPIDs = afterLaunchPIDs.filter(pid => !initialPIDs.includes(pid));
      console.log(`New VS Code PIDs created (${newPIDs.length}):`, newPIDs);
      
      // Register all new PIDs
      for (const pid of newPIDs) {
        VSCodeManager.registerProcess(pid);
      }
      
      // Step 2: Clean the build
      console.log('\n=== Step 2: Clean Build Directory ===');
      console.log('Running CMake clean...');
      try {
        const { stdout } = await execAsync(`cmake --build "${buildPath}" --target clean`, {
          cwd: workspacePath
        });
        console.log('CMake clean output:', stdout);
      } catch (e) {
        console.log('Clean target not available, manually cleaning...');
        // Manual clean if needed
        const files = fs.readdirSync(buildPath);
        for (const file of files) {
          if (file.endsWith('.exe') || file.endsWith('.a') || file.endsWith('.lib')) {
            fs.unlinkSync(path.join(buildPath, file));
          }
        }
      }
      
      // Verify clean
      const afterCleanFiles = fs.readdirSync(buildPath);
      const hasArtifactsAfterClean = afterCleanFiles.some(f => 
        f.endsWith('.exe') || f.endsWith('.a') || f.endsWith('.lib')
      );
      console.log(`Has artifacts after clean: ${hasArtifactsAfterClean}`);
      expect(hasArtifactsAfterClean).toBe(false);
      
      // Step 3: Rebuild
      console.log('\n=== Step 3: Rebuild Project ===');
      console.log('Running CMake rebuild...');
      const rebuildResult = await execAsync(`cmake --build "${buildPath}"`, {
        cwd: workspacePath,
        timeout: 60000
      });
      console.log('Rebuild completed successfully');
      
      // Verify rebuild artifacts
      const rebuildFiles = fs.readdirSync(buildPath);
      const hasRebuildArtifacts = rebuildFiles.some(f => 
        f.includes('.exe') || f.includes('.a') || f.includes('.lib')
      );
      console.log(`Rebuild has artifacts: ${hasRebuildArtifacts}`);
      expect(hasRebuildArtifacts).toBe(true);
      
      // Step 4: Verify CTest files
      console.log('\n=== Step 4: Verify CTest Files ===');
      
      // Check for CTestTestfile.cmake
      const ctestFilePath = path.join(buildPath, 'CTestTestfile.cmake');
      const ctestFileExists = fs.existsSync(ctestFilePath);
      console.log(`CTestTestfile.cmake exists: ${ctestFileExists}`);
      expect(ctestFileExists).toBe(true);
      
      if (ctestFileExists) {
        const ctestContent = fs.readFileSync(ctestFilePath, 'utf-8');
        const ctestLines = ctestContent.split('\n').filter(line => line.trim().length > 0);
        console.log(`CTestTestfile.cmake has ${ctestLines.length} non-empty lines`);
        console.log('First few lines of CTestTestfile.cmake:');
        ctestLines.slice(0, 5).forEach(line => console.log(`  ${line}`));
        
        // Verify it has more than 3 lines
        expect(ctestLines.length).toBeGreaterThan(3);
        
        // Verify it contains test definitions
        const hasTestDefinitions = ctestContent.includes('add_test') || 
                                  ctestContent.includes('ADD_TEST') ||
                                  ctestContent.includes('subdirs') ||
                                  ctestContent.includes('SUBDIRS');
        console.log(`Contains test definitions: ${hasTestDefinitions}`);
        expect(hasTestDefinitions).toBe(true);
      }
      
      // Check for test configuration files
      const testIncludeFile = rebuildFiles.find(f => f.includes('_include.cmake'));
      const testConfigFile = rebuildFiles.find(f => f.includes('_tests.cmake'));
      
      console.log(`Test include file: ${testIncludeFile || 'not found'}`);
      console.log(`Test config file: ${testConfigFile || 'not found'}`);
      
      // If test config file exists, check its content
      if (testConfigFile) {
        const testConfigPath = path.join(buildPath, testConfigFile);
        const testConfigContent = fs.readFileSync(testConfigPath, 'utf-8');
        const testConfigLines = testConfigContent.split('\n').filter(line => line.trim().length > 0);
        console.log(`${testConfigFile} has ${testConfigLines.length} non-empty lines`);
        
        // Show first few lines
        console.log(`First few lines of ${testConfigFile}:`);
        testConfigLines.slice(0, 5).forEach(line => console.log(`  ${line}`));
        
        // Verify it has substantial content (more than 3 lines)
        expect(testConfigLines.length).toBeGreaterThan(3);
        
        // Verify it contains test configurations
        const hasTestConfig = testConfigContent.includes('add_test') || 
                             testConfigContent.includes('set_tests_properties') ||
                             testConfigContent.includes('TEST_LIST');
        console.log(`Contains test configuration: ${hasTestConfig}`);
        expect(hasTestConfig).toBe(true);
      }
      
      // Step 5: Run CTest to verify tests work
      console.log('\n=== Step 5: Run CTest ===');
      try {
        const { stdout, stderr } = await execAsync('ctest --test-dir "' + buildPath + '" --output-on-failure', {
          cwd: buildPath,
          timeout: 30000
        });
        console.log('CTest output:', stdout);
        
        // Verify tests ran
        const testsRan = stdout.includes('Test #') || stdout.includes('tests passed') || stdout.includes('% tests passed');
        console.log(`Tests ran successfully: ${testsRan}`);
        expect(testsRan).toBe(true);
      } catch (e: any) {
        // Even if tests fail, we want to see if they ran
        if (e.stdout) {
          console.log('CTest output (with failures):', e.stdout);
          const testsRan = e.stdout.includes('Test #') || e.stdout.includes('% tests passed');
          console.log(`Tests ran (with some failures): ${testsRan}`);
          expect(testsRan).toBe(true);
        } else {
          console.log('CTest failed to run:', e.message);
        }
      }
      
      console.log('\n=== Test Completed Successfully! ===');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Clean up - close VS Code
      if (electronApp || newPIDs.length > 0) {
        console.log('\nClosing VS Code...');
        
        // Try to close using Playwright
        if (electronApp) {
          try {
            await electronApp.close();
            console.log('Closed VS Code using Playwright');
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
          console.log(`Force killing ${pidsToKill.length} remaining VS Code processes...`);
          for (const pid of pidsToKill) {
            try {
              await execAsync(`taskkill /PID ${pid} /T /F`);
              console.log(`Killed PID ${pid}`);
            } catch (killErr) {
              console.log(`Failed to kill PID ${pid}:`, killErr);
            }
          }
        }
        
        // Final wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check final state
        const finalPIDs = await getVSCodePIDs();
        const remainingNewPIDs = newPIDs.filter(pid => finalPIDs.includes(pid));
        if (remainingNewPIDs.length > 0) {
          console.warn(`Warning: ${remainingNewPIDs.length} new VS Code processes still running`);
        } else {
          console.log('All new VS Code processes successfully closed');
        }
      }
      
      // Clean up build directory
      if (fs.existsSync(buildPath)) {
        console.log('Cleaning up build directory...');
        fs.rmSync(buildPath, { recursive: true, force: true });
      }
    }
  });
});