import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeTestHelper } from '../helpers/vscode-test-helper';

test.describe('CMake Rebuild and CTest Verification', () => {
  test('should configure, build, clean, rebuild and verify CTest files', async () => {
    console.log('Starting CMake rebuild and CTest verification test...');
    
    const workspacePath = path.join(__dirname, '..', 'test-workspace');
    const buildPath = path.join(workspacePath, 'build');
    
    // Create helper with workspace configuration
    const helper = new VSCodeTestHelper({
      workspacePath: workspacePath,
      buildPath: buildPath,
      cleanupBuildDir: true,
      initTimeout: 5000
    });
    
    try {
      // Initialize
      const initResult = await helper.initialize();
      expect(initResult.success).toBe(true);
      
      console.log('\n=== Step 1: Initial Configure and Build ===');
      
      // Configure CMake
      const configResult = await helper.cmakeConfigure({
        sourceDir: workspacePath,
        buildDir: buildPath,
        generator: 'Ninja'
      });
      expect(configResult.success).toBe(true);
      
      // Initial build
      const buildResult = await helper.cmakeBuild(buildPath);
      expect(buildResult.success).toBe(true);
      console.log('Initial build completed successfully');
      
      // Verify initial build artifacts
      const initialArtifacts = helper.verifyBuildArtifacts(buildPath);
      console.log(`Initial build has artifacts: ${initialArtifacts.success}`);
      expect(initialArtifacts.success).toBe(true);
      
      // Launch VS Code
      console.log('\nLaunching VS Code with workspace...');
      const launchResult = await helper.launchVSCode();
      expect(launchResult.success).toBe(true);
      
      console.log('\n=== Step 2: Clean Build Directory ===');
      
      // Clean the build
      const cleanResult = await helper.cmakeClean(buildPath);
      expect(cleanResult.success).toBe(true);
      
      // Verify clean
      const artifactsAfterClean = helper.verifyBuildArtifacts(buildPath);
      console.log(`Has artifacts after clean: ${artifactsAfterClean.success}`);
      expect(artifactsAfterClean.success).toBe(false);
      
      console.log('\n=== Step 3: Rebuild Project ===');
      
      // Rebuild
      const rebuildResult = await helper.cmakeBuild(buildPath);
      expect(rebuildResult.success).toBe(true);
      console.log('Rebuild completed successfully');
      
      // Verify rebuild artifacts
      const rebuildArtifacts = helper.verifyBuildArtifacts(buildPath);
      console.log(`Rebuild has artifacts: ${rebuildArtifacts.success}`);
      expect(rebuildArtifacts.success).toBe(true);
      
      console.log('\n=== Step 4: Verify CTest Files ===');
      
      // Verify CTest files
      const ctestResult = helper.verifyCTestFiles(buildPath);
      expect(ctestResult.success).toBe(true);
      
      if (ctestResult.data) {
        console.log(`CTestTestfile.cmake exists: ${ctestResult.data.exists}`);
        console.log(`CTestTestfile.cmake has ${ctestResult.data.lineCount} non-empty lines`);
        console.log('First few lines of CTestTestfile.cmake:');
        ctestResult.data.firstFewLines?.forEach((line: string) => 
          console.log(`  ${line}`)
        );
        console.log(`Contains test definitions: ${ctestResult.data.hasTestDefinitions}`);
      }
      
      // Check for additional test files
      const buildFiles = fs.readdirSync(buildPath);
      const testConfigFile = buildFiles.find(f => f.includes('_tests.cmake'));
      
      if (testConfigFile) {
        const testConfigPath = path.join(buildPath, testConfigFile);
        const testConfigContent = fs.readFileSync(testConfigPath, 'utf-8');
        const testConfigLines = testConfigContent.split('\n').filter(line => line.trim().length > 0);
        
        console.log(`${testConfigFile} has ${testConfigLines.length} non-empty lines`);
        console.log(`First few lines of ${testConfigFile}:`);
        testConfigLines.slice(0, 5).forEach(line => console.log(`  ${line}`));
        
        expect(testConfigLines.length).toBeGreaterThan(3);
        
        const hasTestConfig = testConfigContent.includes('add_test') || 
                             testConfigContent.includes('set_tests_properties');
        console.log(`Contains test configuration: ${hasTestConfig}`);
        expect(hasTestConfig).toBe(true);
      }
      
      console.log('\n=== Step 5: Run CTest ===');
      
      // Run CTest
      const ctestRunResult = await helper.runCTest(buildPath);
      expect(ctestRunResult.success).toBe(true);
      console.log(`Tests ran successfully: ${ctestRunResult.data?.testsRan}`);
      
      console.log('\n=== Test Completed Successfully! ===');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Close VS Code and cleanup
      const closeResult = await helper.closeVSCode();
      expect(closeResult.success).toBe(true);
      
      await helper.cleanup();
    }
  });
});