import { test, expect } from '@playwright/test';
import { VSCodeTestHelper } from '../helpers/vscode-test-helper';

test.describe('Simple VS Code Launch Test', () => {
  test('should open and close VS Code successfully', async () => {
    console.log('Starting VS Code launch test...');
    
    // Create helper with default configuration
    const helper = new VSCodeTestHelper({
      initTimeout: 3000
    });
    
    try {
      // Initialize test environment
      const initResult = await helper.initialize();
      expect(initResult.success).toBe(true);
      
      // Launch VS Code
      const launchResult = await helper.launchVSCode();
      expect(launchResult.success).toBe(true);
      expect(launchResult.data?.app).toBeTruthy();
      
      console.log('VS Code is running');
      console.log('Test completed successfully!');
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    } finally {
      // Close VS Code
      const closeResult = await helper.closeVSCode();
      expect(closeResult.success).toBe(true);
    }
  });
});