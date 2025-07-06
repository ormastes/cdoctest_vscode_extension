import * as path from 'path';
import * as cp from 'child_process';
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, './index');
    
    // Download VS Code
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    
    // The folder containing the Extension Manifest package.json
    const extensionPath = extensionDevelopmentPath;

    // Run tests with coverage
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--new-window'
      ],
      extensionTestsEnv: {
        COVERAGE: 'true'
      }
    });

    // Generate coverage report
    console.log('Generating coverage report...');
    cp.execSync('npx nyc report', { stdio: 'inherit', cwd: extensionDevelopmentPath });
    
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();