import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeTestHelper } from '../helpers/vscode-test-helper';

test.describe('CMake Clean Test', () => {
  test('should open VS Code, run CMake clean, and verify build directory', async () => {
    console.log('Starting CMake clean test...');
    
    const workspacePath = path.join(__dirname, '..', 'test-workspace');
    const buildPath = path.join(workspacePath, 'build');
    
    // Create helper with workspace configuration
    const helper = new VSCodeTestHelper({
      workspacePath: workspacePath,
      buildPath: buildPath,
      cleanupBuildDir: true
    });
    
    try {
      // Initialize
      const initResult = await helper.initialize();
      expect(initResult.success).toBe(true);
      
      console.log('Setting up initial build directory...');
      
      // Configure CMake
      const configResult = await helper.cmakeConfigure({
        sourceDir: workspacePath,
        buildDir: buildPath,
        generator: 'Ninja'
      });
      expect(configResult.success).toBe(true);
      
      // Build the project
      const buildResult = await helper.cmakeBuild(buildPath);
      expect(buildResult.success).toBe(true);
      
      // Verify build artifacts exist
      const artifactsBeforeClean = helper.verifyBuildArtifacts(buildPath);
      console.log(`Build directory has executables/libraries: ${artifactsBeforeClean.success}`);
      expect(artifactsBeforeClean.success).toBe(true);
      
      // Launch VS Code
      const launchResult = await helper.launchVSCode();
      expect(launchResult.success).toBe(true);
      
      // Clean the build
      console.log('Running CMake clean command...');
      const cleanResult = await helper.cmakeClean(buildPath);
      expect(cleanResult.success).toBe(true);
      
      // Wait for clean to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify build directory is cleaned
      console.log('Verifying build directory is cleaned...');
      const artifactsAfterClean = helper.verifyBuildArtifacts(buildPath);
      console.log(`Has artifacts after clean: ${artifactsAfterClean.success}`);
      expect(artifactsAfterClean.success).toBe(false);
      
      // Check if bin/lib directories are empty
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
      
      expect(binIsEmpty).toBe(true);
      expect(libIsEmpty).toBe(true);
      
      console.log('Build directory successfully cleaned!');
      console.log('Test completed successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Close VS Code
      const closeResult = await helper.closeVSCode();
      expect(closeResult.success).toBe(true);
      
      // Cleanup
      await helper.cleanup();
    }
  });
});