import * as path from 'path';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const testsRoot = path.resolve(__dirname, '.');

  try {
    // Find all test files
    const files = await glob('**/*.test.js', { cwd: testsRoot });
    
    // Import and run each test file
    for (const file of files) {
      const testPath = path.resolve(testsRoot, file);
      await import(testPath);
    }
  } catch (err) {
    console.error('Error running tests:', err);
    throw err;
  }
}