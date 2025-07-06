import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    const extensionTestsPath = path.resolve(__dirname, './index');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        // Keep necessary extensions enabled
        '--disable-extension=ms-vsliveshare.vsliveshare',
        '--disable-extension=eamodio.gitlens',
        '--disable-extension=mhutchie.git-graph',
        '--disable-extension=ms-vscode-remote.remote-wsl',
        '--disable-extension=ms-azuretools.vscode-docker',
        // Add a test workspace
        path.resolve(__dirname, './test-workspace')
      ],
      extensionTestsEnv: {
        VSCODE_TEST_MODE: 'true',
        CMAKE_EXTENSION_ENABLED: 'true',
        CPP_EXTENSION_ENABLED: 'true'
      }
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();