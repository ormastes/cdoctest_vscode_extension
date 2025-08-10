import { VSCodeManager } from './helpers/vscode-manager';

async function globalTeardown() {
  console.log('Running global teardown...');
  
  // Get all tracked processes before cleanup
  const trackedPids = VSCodeManager.getTrackedProcesses();
  if (trackedPids.length > 0) {
    console.log(`Found ${trackedPids.length} tracked VS Code processes: ${trackedPids.join(', ')}`);
  }
  
  // Clean up only tracked VS Code processes
  await VSCodeManager.cleanup();
  
  console.log('Global teardown completed');
}

export default globalTeardown;