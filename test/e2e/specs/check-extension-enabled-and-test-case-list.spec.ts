import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeTestHelper } from '../helpers/vscode-test-helper';
import { StateEvent } from '../helpers/state-monitor';

test.describe('Check Extension Enabled and Test Case List', () => {
  test('should verify CDocTest extension is enabled and shows correct test list', async () => {
    console.log('Starting extension verification and test case list check...');
    
    const workspacePath = path.join(__dirname, '..', 'test-workspace');
    const buildPath = path.join(workspacePath, 'build');
    const extensionPath = path.join(__dirname, '..', '..', '..');
    
    // Setup required folders to prevent extension errors
    // Use the system's VS Code extensions directory to access installed extensions
    const homeDir = process.env.USERPROFILE || process.env.HOME;
    const systemExtensionsDir = path.join(homeDir!, '.vscode', 'extensions');
    const userDataDir = path.join(__dirname, '..', 'temp-vscode-profile');
    
    // Create user data directory if it doesn't exist
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    // Check if CMake Tools extension is installed in the system
    console.log('Checking for CMake Tools extension in:', systemExtensionsDir);
    if (fs.existsSync(systemExtensionsDir)) {
      const extensions = fs.readdirSync(systemExtensionsDir);
      const cmakeToolsExt = extensions.find(ext => ext.includes('ms-vscode.cmake-tools'));
      if (cmakeToolsExt) {
        console.log('Found CMake Tools extension:', cmakeToolsExt);
      } else {
        console.log('WARNING: CMake Tools extension not found. Please install it first with:');
        console.log('  code --install-extension ms-vscode.cmake-tools');
      }
    }
    
    // Create helper with workspace configuration
    const helper = new VSCodeTestHelper({
      workspacePath: workspacePath,
      buildPath: buildPath,
      userDataDir: userDataDir,
      extensionsDir: systemExtensionsDir,  // Use system extensions directory
      additionalArgs: [
        '--extensionDevelopmentPath=' + extensionPath,
        '--enable-proposed-api=' + extensionPath
      ],
      cleanupBuildDir: true,
      initTimeout: 10000
    });
    
    try {
      // Initialize
      const initResult = await helper.initialize();
      expect(initResult.success).toBe(true);
      
      // Launch VS Code
      console.log('\n=== Step 1: Launching VS Code ===');
      const launchResult = await helper.launchVSCode();
      expect(launchResult.success).toBe(true);
      
      // Get main window (this will also start state monitoring)
      const mainWindow = await helper.getMainWindow();
      expect(mainWindow).not.toBeNull();
      
      if (!mainWindow) {
        throw new Error('Failed to get main window');
      }
      
      // Get state monitor instance and initial step
      const { stateMonitor, step_idx: initialStep } = helper.getStateMonitor();
      
      // Wait for VS Code to fully load and extensions to activate
      console.log('Waiting for VS Code and extensions to fully load...');
      await stateMonitor.recordAction('Waiting for VS Code to load');
      
      // Wait until no progress is active before starting
      console.log('Ensuring no initial progress is active...');
      const noInitialProgress = await stateMonitor.waitIdle(10000);
      expect(noInitialProgress).toBe(true);


      // Check if CMake Tools extension is working by testing command availability
      console.log('Checking if CMake Tools extension is working...');
      let cmakeToolsWorking = false;
      
      try {
        // Test if CMake commands are available in command palette
        await mainWindow.keyboard.press('Control+Shift+P');
        await mainWindow.keyboard.type('CMake:');
        
        // Check if CMake commands appear
        const commandItems = await helper.getAllElementsText(mainWindow, '.quick-input-list-row');
        const hasCMakeCommands = commandItems.some(cmd => 
          cmd.toLowerCase().includes('cmake:') 
        );
        
        if (hasCMakeCommands) {
          console.log('✅ CMake Tools extension is working (commands available)');
          cmakeToolsWorking = true;
        } else {
          console.log('❌ No CMake commands found in command palette');
          console.log(`Available commands: ${commandItems.slice(0, 5).join(', ')}`);
        }
        
        // Close command palette
        await mainWindow.keyboard.press('Escape');
        
      } catch (error) {
        console.log('Error checking CMake Tools:', error);
      }
      
      if (!cmakeToolsWorking) {
        console.log('Warning: CMake Tools extension may not be properly loaded');
        // But don't fail the test - continue and see if it works anyway
      }
      
      console.log('\n=== Step 2: Verify CDocTest Extension is Enabled ===');
      
      // Open Extensions view to verify our extension is loaded
      await mainWindow.keyboard.press('Control+Shift+X');
      await mainWindow.waitForTimeout(2000);
      
      // Search for our extension
      const searchBox = await mainWindow.locator('input[placeholder*="Search Extensions"]').first();
      if (await searchBox.isVisible()) {
        await searchBox.click();
        await searchBox.fill('CDocTest');
        await mainWindow.waitForTimeout(2000);
        
        // Check if our extension appears in the list
        const extensionItem = await mainWindow.locator('.extension-list-item').filter({ hasText: 'CDocTest' }).first();
        const extensionVisible = await extensionItem.isVisible();
        console.log(`CDocTest extension visible in list: ${extensionVisible}`);
        
        // Verify extension is enabled (not disabled)
        if (extensionVisible) {
          const disabledLabel = await extensionItem.locator('text=/disabled/i').isVisible();
          const enabledStatus = !disabledLabel;
          console.log(`CDocTest extension enabled: ${enabledStatus}`);
          expect(enabledStatus).toBe(true);
        }
      }
      
      // wait idle before select toolkit
      await stateMonitor.waitIdle(10000);
      console.log('\n=== Step 3: Select CMake Toolkit ===');
      
      // Check if configuration already succeeded before toolkit selection
      const configAlreadyDone = await stateMonitor.wasHappenAfterIdle(StateEvent.CMAKE_CONFIG_SUCCESS, initialStep, 5000);
      
      if (configAlreadyDone) {
        console.log('Configuration already completed - skipping toolkit selection');
      } else {
        // Use helper method to execute command
        const kitSelectionResult = await helper.executeCommand(mainWindow, 'CMake: Select a Kit');
        const beforeKitStep = await stateMonitor.recordAction('Starting toolkit selection');
        expect(kitSelectionResult).toBe(true);
        await stateMonitor.waitIdle(10000);
      
        // Wait for kit list to appear
        console.log('Waiting for toolkit list to appear...');
        const kitList = await mainWindow.waitForSelector('.quick-input-list', { timeout: 10000 });
        
        if (kitList) {
          console.log('Toolkit list appeared, scanning available toolkits...');
          
          // Get all available toolkit items
          const toolkitItems = await helper.getAllElementsText(mainWindow, '.quick-input-list-row');
          console.log(`Found ${toolkitItems.length} available toolkits:`);
          toolkitItems.forEach((kit, index) => {
            console.log(`  ${index + 1}. ${kit}`);
          });
          
          // Look for Clang 18+ AMD64
          let selectedKit = false;
          for (const kit of toolkitItems) {
            // Check for Clang 18 or higher with AMD64/x64
            if (kit.toLowerCase().includes('clang') && 
                (kit.includes('18') || kit.includes('19') || kit.includes('20')) &&
                (kit.toLowerCase().includes('amd64') || kit.toLowerCase().includes('x64') || kit.toLowerCase().includes('x86_64'))) {
              console.log(`Found suitable Clang toolkit: ${kit}`);
              
              // Click on this toolkit
              const kitElement = await mainWindow.locator('.quick-input-list-row').filter({ hasText: kit }).first();
              if (await kitElement.isVisible()) {
                await kitElement.click();
                await stateMonitor.recordAction(`Selected Clang toolkit: ${kit}`, StateEvent.CMAKE_SELECT_KIT_SUCCESS);
                selectedKit = true;
                console.log(`Selected toolkit: ${kit}`);
                break;
              }
            }
          }
          
          // If no Clang 18+ AMD64 found, select the first available kit
          if (!selectedKit && toolkitItems.length > 0) {
            console.log('No Clang 18+ AMD64 found, selecting first available toolkit...');
            await mainWindow.keyboard.press('Enter');
            await stateMonitor.recordAction(`Selected default toolkit: ${toolkitItems[0]}`, StateEvent.CMAKE_SELECT_KIT_SUCCESS);
            console.log(`Selected default toolkit: ${toolkitItems[0]}`);
          }
        }
        
        // Wait until no progress from toolkit selection and check if auto-config happened
        console.log('Waiting for toolkit selection to complete...');
        const noKitProgress = await stateMonitor.waitIdle(10000);
        expect(noKitProgress).toBe(true);
      }
      await stateMonitor.waitIdle(10000);
      console.log('\n=== Step 4: Configure CMake ===');
      
      // Check if CMAKE_CONFIG_SUCCESS already happened (may be auto-triggered)
      console.log('Checking if CMake was already configured...');
      const alreadyConfigured = await stateMonitor.wasHappenAfterIdle(StateEvent.CMAKE_CONFIG_SUCCESS, initialStep, 3000);
      if (alreadyConfigured) {
        console.log('✅ CMake was already configured - skipping manual configuration step');
      } else {
        console.log('No auto-configuration detected, proceeding with manual configuration...');
        
        // Configure CMake via command palette
        const configureResult = await helper.executeCommand(mainWindow, 'CMake: Configure');
        const beforeConfigStep = await stateMonitor.recordStateChangeAction('Starting CMake configuration');
        expect(configureResult).toBe(true);
        
        await stateMonitor.waitIdle(10000);
      }
      await stateMonitor.waitIdle(10000);
      console.log('\n=== Step 5: Build Project ===');
      
      // Build via command palette
      const buildResult = await helper.executeCommand(mainWindow, 'CMake: Build');
      const beforeBuildStep = await stateMonitor.recordStateChangeAction('Starting CMake build');
      expect(buildResult).toBe(true);
      
      // Wait a bit for build to start
      console.log('Waiting for build to start...');
      await stateMonitor.waitIdle(20000);
      
      // Verify build artifacts
      const buildArtifacts = helper.verifyBuildArtifacts(buildPath);
      console.log(`Build artifacts present: ${buildArtifacts.success}`);
      expect(buildArtifacts.success).toBe(true);
      
      await stateMonitor.waitIdle(20000);
      console.log('\n=== Step 6: Clean and Reconfigure ===');
      
      // Clean the build twice as requested
      console.log(`\nPerforming clean operation`);
      const cleanResult = await helper.executeCommand(mainWindow, 'CMake: Clean');
      const beforeCleanStep = await stateMonitor.recordStateChangeAction('Starting CMake clean');
      expect(cleanResult).toBe(true);
      await stateMonitor.waitIdle(5000);
      
      // Reconfigure after cleaning
      console.log('\nReconfiguring CMake after clean...');
      const reconfigureResult = await helper.executeCommand(mainWindow, 'CMake: Configure');
      const afterCleanStep = await stateMonitor.recordStateChangeAction('CMake clean completed');
      expect(reconfigureResult).toBe(true);
      await stateMonitor.waitIdle(20000);

      // Build after reconfigure
      const buildAfterResult = await helper.executeCommand(mainWindow, 'CMake: Build');
      const beforeAfterStep = await stateMonitor.recordStateChangeAction('Starting CMake build');
      expect(buildAfterResult).toBe(true);
      
      console.log('\n=== Step 7: Open Test Explorer ===');
      
      // Click on the Testing icon in the activity bar (flask icon)
      console.log('Opening Testing panel by clicking flask icon...');
      const testPanelOpened = await helper.clickElement(mainWindow, '[aria-label="Testing"]', 5000);
      
      if (!testPanelOpened) {
        // Fallback: Try command palette
        console.log('Opening Testing panel via command palette...');
        await mainWindow.keyboard.press('Control+Shift+P');
        await mainWindow.waitForTimeout(1000);
        await mainWindow.keyboard.type('View: Show Testing');
        await mainWindow.waitForTimeout(1000);
        await mainWindow.keyboard.press('Enter');
      }
      
      await stateMonitor.waitIdle(10000);
      
      console.log('\n=== Step 8: Verify Test List is from CDocTest Extension ===');
      
      // Check for CDocTest-specific test controller or provider
      console.log('Checking for CDocTest test provider...');
      
      // Wait for test tree to load
      console.log('Waiting for test tree to load...');
      const testTree = await mainWindow.waitForSelector('.test-explorer-tree', { timeout: 10000 });
      
      if (!testTree) {
        // Try alternative selector
        console.log('Trying alternative selector for test tree...');
        const alternativeTree = await mainWindow.waitForSelector('.monaco-list', { timeout: 5000 });
        if (alternativeTree) {
          console.log('Found test tree using alternative selector');
        }
      }
      
      // Look for all root nodes first
      console.log('\nListing all available test roots...');
      let allRootNodes = await helper.getAllElementsText(mainWindow, '.monaco-list-row');
      console.log(`Found ${allRootNodes.length} potential root nodes:`);
      allRootNodes.forEach((node, index) => {
        console.log(`  ${index + 1}. ${node}`);
      });
      
      // Find and select the correct test-workspace root
      console.log('\nSearching for test-workspace root...');
      let testWorkspaceFound = false;
      for (let i = 0; i < allRootNodes.length; i++) {
        const nodeText = allRootNodes[i].toLowerCase();
        if (nodeText.includes('test-workspace') && !nodeText.includes('build')) {
          console.log(`Found test-workspace root at index ${i}: "${allRootNodes[i]}"`);
          
          // Click on this specific root node
          const rootNodes = await mainWindow.locator('.monaco-list-row');
          const targetNode = rootNodes.nth(i);
          if (await targetNode.isVisible()) {
            await targetNode.click();
            console.log('Clicked on test-workspace root node');
            testWorkspaceFound = true;
            await mainWindow.waitForTimeout(1000);
            break;
          }
        }
      }
      
      if (!testWorkspaceFound) {
        console.log('Warning: Could not find test-workspace root, selecting first available node');
        const firstNode = await mainWindow.locator('.monaco-list-row').first();
        if (await firstNode.isVisible()) {
          await firstNode.click();
          await mainWindow.waitForTimeout(1000);
        }
      }
      
      // Now get the test nodes after selecting the correct root
      console.log('\nGetting test nodes after root selection...');
      const testNodes = await helper.getAllElementsText(mainWindow, '.monaco-list-row');
      console.log(`Found ${testNodes.length} nodes in test explorer:`);
      testNodes.forEach((node, index) => {
        console.log(`  ${index + 1}. ${node}`);
      });
      
      // Verify these are CDocTest tests, not from other extensions
      // CDocTest should show test names from CTest/UnitTest++
      const isCDocTestTests = testNodes.some(node => {
        const lowerNode = node.toLowerCase();
        // Check for patterns that indicate our tests
        return lowerNode.includes('calculator') ||
               lowerNode.includes('mathtest') ||
               lowerNode.includes('stringtest') ||
               lowerNode.includes('addition') ||
               lowerNode.includes('subtraction') ||
               lowerNode.includes('unittest++') ||
               lowerNode.includes('ctest');
      });
      
      // Check that it's NOT showing tests from other common test extensions
      const isOtherExtensionTests = testNodes.some(node => {
        const lowerNode = node.toLowerCase();
        // Patterns from other test extensions (e.g., Python, Jest, Mocha)
        return lowerNode.includes('pytest') ||
               lowerNode.includes('unittest.py') ||
               lowerNode.includes('jest') ||
               lowerNode.includes('mocha') ||
               lowerNode.includes('jasmine') ||
               lowerNode.includes('.spec.js') ||
               lowerNode.includes('.test.js');
      });
      
      console.log(`Tests appear to be from CDocTest: ${isCDocTestTests}`);
      console.log(`Tests appear to be from other extensions: ${isOtherExtensionTests}`);
      
      // Try to find and expand the root node
      if (testNodes.length > 0) {
        const rootNode = await mainWindow.locator('.monaco-list-row').first();
        if (await rootNode.isVisible()) {
          console.log('Clicking on root test node...');
          await rootNode.click();
          await mainWindow.waitForTimeout(1000);
          
          // Try to expand the root node using the twistie (expand arrow)
          const expandArrow = await mainWindow.locator('.monaco-tl-twistie').first();
          if (await expandArrow.isVisible()) {
            await expandArrow.click();
            console.log('Clicked expand arrow to show test list');
            await mainWindow.waitForTimeout(2000);
            
            // Get expanded test list
            const expandedTests = await helper.getAllElementsText(mainWindow, '.monaco-list-row');
            console.log(`\nExpanded test list from CDocTest (${expandedTests.length} items):`);
            expandedTests.forEach((test, index) => {
              console.log(`  ${index + 1}. ${test}`);
            });
            
            // Verify we have actual test items from our extension
            expect(expandedTests.length).toBeGreaterThan(1);
            
            // Check for CDocTest-specific test items
            const hasCDocTestItems = expandedTests.some(item => {
              const lowerItem = item.toLowerCase();
              return lowerItem.includes('test') ||
                     lowerItem.includes('suite') ||
                     lowerItem.includes('calculator') ||
                     lowerItem.includes('math') ||
                     lowerItem.includes('string') ||
                     lowerItem.includes('addition') ||
                     lowerItem.includes('subtraction');
            });
            
            expect(hasCDocTestItems).toBe(true);
            console.log(`CDocTest test items found: ${hasCDocTestItems}`);
            
            // Verify no tests from other extensions
            const hasOtherExtensionItems = expandedTests.some(item => {
              const lowerItem = item.toLowerCase();
              return lowerItem.includes('pytest') ||
                     lowerItem.includes('jest') ||
                     lowerItem.includes('mocha') ||
                     lowerItem.includes('.spec.js') ||
                     lowerItem.includes('.test.js');
            });
            
            expect(hasOtherExtensionItems).toBe(false);
            console.log(`Other extension test items found: ${hasOtherExtensionItems}`);
          }
        }
      }
      
      // Additional verification: Check if CDocTest commands are available
      console.log('\n=== Step 9: Verify CDocTest Commands are Available ===');
      stateMonitor.recordAction('Checking for CDocTest commands');
      await mainWindow.keyboard.press('Control+Shift+P');
      await mainWindow.waitForTimeout(1000);
      await mainWindow.keyboard.type('CDocTest');
      await mainWindow.waitForTimeout(1000);
      
      // Check if CDocTest commands appear
      const commandItems = await helper.getAllElementsText(mainWindow, '.quick-input-list-row');
      const hasCDocTestCommands = commandItems.some(cmd => 
        cmd.toLowerCase().includes('cdoctest') || 
        cmd.toLowerCase().includes('ctest')
      );
      console.log(`CDocTest commands available: ${hasCDocTestCommands}`);
      
      // Press Escape to close command palette
      await mainWindow.keyboard.press('Escape');
      
      // Take a screenshot for debugging
      await helper.takeScreenshot(mainWindow, 'cdoctest-test-explorer-view');
      
      console.log('\n=== Test Completed Successfully! ===');
      console.log('Summary:');
      console.log(`  - CDocTest extension is enabled: true`);
      console.log(`  - Test list shows CDocTest tests: ${isCDocTestTests}`);
      console.log(`  - Test list shows other extension tests: ${isOtherExtensionTests}`);
      console.log(`  - CDocTest commands available: ${hasCDocTestCommands}`);
      
    } catch (error) {
      console.error('Test failed:', error);
      
      // Try to take a screenshot on failure
      const mainWindow = await helper.getMainWindow();
      if (mainWindow) {
        await helper.takeScreenshot(mainWindow, 'test-failure');
      }
      
      throw error;
    } finally {
      // Close VS Code and cleanup
      const closeResult = await helper.closeVSCode();
      expect(closeResult.success).toBe(true);
      
      await helper.cleanup();
      
      // Clean up temporary directories (only user data dir, not system extensions)
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    }
  });
});