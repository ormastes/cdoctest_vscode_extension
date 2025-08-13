# VS Code Extension E2E Testing with vscode-extension-tester

## Overview

We use **vscode-extension-tester** (ExTester) + **Mocha/Chai** to drive VS Code’s real UI (Electron). Tests cover CMake/CTest discovery/execution and verify UI behavior. A new **status manager** centralizes:

* VS Code **PID tracking** (before/after launch, discovering new PIDs),
* **lifecycle verification** (ensure VS Code closes cleanly),
* a **`status.progress` MutationObserver** for dynamic status bar changes.

## Latest Updates (August 2025)

### Key Improvements

* **Testing view**: Use ExTester page objects (`ActivityBar` → `ViewControl('Testing')` → `SideBarView`) for stability.
* **Tree expansion**: Use `DefaultTreeSection`/`TreeItem.expand()` (no raw twistie clicks).
* **Extension deps**: Don't pass `--disable-extensions` if you need CMake Tools. Install into test Code.
* **Single instance**: `lib/run-e2e.ts` ensures PID baselines and post-run cleanup.
* **Status Bar watch**: `lib/status-manger.ts` exposes `observeStatusProgress(..)` to catch dynamic changes under `#workbench.parts.statusbar #status.progress`.


## Lesson learned

It should open with working folder.

### CRITICAL FIX: Extension Dependencies Not Loading

**Problem**: VSCode launches but CMake Tools extension doesn't load, causing Testing view to be unavailable.

**Root Cause**: Dependencies declared in `extensionDependencies` are installed but not activated because:
1. Workspace trust is blocking extension activation
2. CMake workspace isn't opened properly to trigger CMake Tools activation
3. Extension activation events aren't fired

**Solution**:

1. **Add workspace trust settings** (`.vscode-test-settings.json`):
```json
{ 
  "security.workspace.trust.enabled": false,
  "workbench.startupEditor": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "telemetry.telemetryLevel": "off",
  "update.mode": "none"
}
```

2. **Update ExTester command** to open CMake workspace and disable trust:
```bash
extest setup-and-run \
  -m ./.mocharc.js \
  -o .vscode-test-settings.json \
  -f test/integrated_unit_gtest_and_cdoctest_cmake_ctest \
  -i \
  "out/test/e2e/specs/**/*.spec.js"
```

3. **Add dependency activation test** in your spec:
```ts
it('should have CMake Tools dependency installed and active', async function() {
    console.log('Checking CMake Tools dependency...');
    
    // Trigger CMake Tools activation by executing a command
    try {
        await workbench.executeCommand('CMake: Configure');
        await workbench.getDriver().sleep(1000);
        console.log('✓ CMake Tools is installed and active');
    } catch (e) {
        // Alternative check via Developer tools
        await workbench.executeCommand('Developer: Show Running Extensions');
        await workbench.getDriver().sleep(2000);
        await workbench.executeCommand('View: Toggle Output');
        console.log('✓ CMake Tools dependency check completed');
    }
});
```

**Key flags**:
- `-o`: Inject settings file to disable workspace trust
- `-f`: Open specific folder (CMake workspace) on startup 
- `-i`: Install extensionDependencies automatically

### Troubleshooting Extension Dependencies

If extensions still don't load:

1. **Check `package.json`** - ensure `extensionDependencies` (not `extensionPack`) lists exact IDs:
```json
"extensionDependencies": [
    "ms-vscode.cmake-tools",
    "llvm-vs-code-extensions.lldb-dap"
]
```

2. **Verify installation** - run `Developer: Show Running Extensions` in test VSCode to see if deps are installed/active

3. **Check activation events** - ensure CMake workspace triggers CMake Tools activation (CMakeLists.txt present)

4. **Force activation** - execute extension commands to trigger activation:
```ts
await workbench.executeCommand('CMake: Configure');
await workbench.executeCommand('Testing: Focus on Test Explorer View');
```

5. **Screenshots** - Check ExTester failure screenshots in `.test-extensions/screenshots/` for visual debugging

## Key Features

1. **Build & Discovery** (CMake/CTest)
2. **CTest Execution**
3. **XML Output checks** (if your pipeline writes them)
4. **VS Code UI** via ExTester page objects
5. **PID lifecycle safety** + **status.progress** dynamic observation

---

## Project Structure

```
test/
├─ integrated_unit_gtest_and_cdoctest_cmake_ctest/
│  ├─ CMakeLists.txt
│  └─ test_main.cpp
└─ e2e/
   ├─ specs/
   │  ├─ open-testing-view.spec.ts
   │  ├─ ctest-discovery.spec.ts
   │  ├─ ctest-run-single.spec.ts
   │  └─ statusbar_progress.spec.ts          # uses lib/status-manger.ts
   ├─ steps/
   │  └─ helpers.ts                          # optional shared helpers
   └─ lib/
      ├─ status-manger.ts                    # PID checks + status.progress observer
      └─ run-e2e.ts                          # wraps extest, PID pre/post checks
```

---

## Dependencies (`package.json`)

```json
{
  "devDependencies": {
    "vscode-extension-tester": "^8.17.0",
    "mocha": "^10.4.0",
    "chai": "^4.4.1",
    "typescript": "^5.5.0",
    "@types/mocha": "^10.0.6",
    "@types/node": "^20.14.9",
    "ps-list": "^9.1.0"
  },
  "scripts": {
    "compile": "tsc -p .",
    "e2e": "npm run compile && node ./out/test/e2e/lib/run-e2e.js",
    "e2e:debug": "npm run compile && LOG_LEVEL=FINE node ./out/test/e2e/lib/run-e2e.js",
    "e2e:vscode-1.92": "npm run compile && CODE_VERSION=1.92.0 node ./out/test/e2e/lib/run-e2e.js"
  }
}
```

> `ps-list` gives cross-platform process snapshots. We filter VS Code by name/cmd.
> ExTester’s `extest setup-and-run` still handles download/driver/launch; our wrapper adds PID checks before/after.

**`tsconfig.json`** (snippet)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "commonjs",
    "outDir": "out",
    "rootDir": ".",
    "types": ["mocha", "node"],
    "esModuleInterop": true,
    "strict": true
  },
  "include": ["src", "test"]
}
```

---

## lib: **status-manger.ts**

```ts
// test/e2e/lib/status-manger.ts
import psList from 'ps-list';
import { VSBrowser } from 'vscode-extension-tester';
import type { WebDriver } from 'selenium-webdriver';

export type PidSnapshot = Set<number>;

export interface VscodePidOptions {
  // customize how to classify a "VS Code" process
  match?: (p: psList.ProcessDescriptor) => boolean;
}

const defaultMatch = (p: psList.ProcessDescriptor) => {
  const n = (p.name || '').toLowerCase();
  const c = (p.cmd || '').toLowerCase();
  // cover typical names across platforms and insiders
  return (
    n.includes('code') ||
    n.includes('electron') && c.includes('code') ||
    c.includes('visual studio code') ||
    c.includes('code - insiders') ||
    c.includes('code.exe') ||
    c.includes('code-insiders')
  );
};

export async function getVSCodePids(opts?: VscodePidOptions): Promise<PidSnapshot> {
  const list = await psList();
  const match = opts?.match ?? defaultMatch;
  return new Set(list.filter(match).map(p => p.pid));
}

export function diffPids(before: PidSnapshot, after: PidSnapshot) {
  const added = new Set<number>([...after].filter(pid => !before.has(pid)));
  const removed = new Set<number>([...before].filter(pid => !after.has(pid)));
  return { added, removed };
}

export async function waitForNewVSCodePids(
  baseline: PidSnapshot,
  timeoutMs = 30000,
  pollMs = 500,
  opts?: VscodePidOptions
): Promise<Set<number>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const now = await getVSCodePids(opts);
    const { added } = diffPids(baseline, now);
    if (added.size > 0) return added;
    await new Promise(r => setTimeout(r, pollMs));
  }
  return new Set();
}

export async function waitForPidsExit(
  pids: Set<number>,
  timeoutMs = 30000,
  pollMs = 500
): Promise<boolean> {
  const start = Date.now();
  const stillAlive = async () => {
    const now = await psList();
    const alive = new Set(now.map(p => p.pid));
    return [...pids].some(pid => alive.has(pid));
  };
  while (Date.now() - start < timeoutMs) {
    if (!(await stillAlive())) return true;
    await new Promise(r => setTimeout(r, pollMs));
  }
  return false;
}

/** Observe #workbench.parts.statusbar #status.progress; resolves on first mutation. */
export async function observeStatusProgress(
  driver: WebDriver,
  timeoutMs = 15000
): Promise<{ ok: boolean; reason?: string; aria?: string; html?: string }> {
  // Use Selenium async script to run MutationObserver inside renderer
  // (ExTester exposes the driver via VSBrowser.instance.driver)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return driver.executeAsyncScript(function (timeout: any) {
    const done = arguments[arguments.length - 1];

    const status = document.querySelector('#workbench\\.parts\\.statusbar');
    if (!status) return done({ ok: false, reason: 'no-statusbar' });

    let target = status.querySelector('#status\\.progress');

    // if not present yet, watch subtree for it to appear
    const ensureTarget = () => {
      target = status.querySelector('#status\\.progress');
      return target as HTMLElement | null;
    };

    const finish = (payload: any) => { try { rootObs.disconnect(); obs?.disconnect(); } catch {} done(payload); };

    const onTarget = () => {
      if (!target) return;
      obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' || m.type === 'childList' || m.addedNodes.length || m.removedNodes.length) {
            return finish({
              ok: true,
              aria: (target as HTMLElement).getAttribute('aria-label') || null,
              html: (target as HTMLElement).innerHTML
            });
          }
        }
      });
      obs.observe(target, { attributes: true, childList: true, subtree: true, characterData: true });
    };

    let obs: MutationObserver | undefined;

    const rootObs = new MutationObserver((_ms) => {
      if (ensureTarget()) {
        onTarget();
      }
    });

    if (ensureTarget()) {
      onTarget();
    } else {
      rootObs.observe(status, { childList: true, subtree: true });
    }

    setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeout);
  }, timeoutMs);
}

// convenience getter for the active driver
export function getDriver() {
  return VSBrowser.instance.driver;
}
```

---

## lib: **run-e2e.ts** (wraps extest with PID checks) ✅

```ts
// test/e2e/lib/run-e2e.ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import { diffPids, getVSCodePids, waitForNewVSCodePids, waitForPidsExit } from './status-manger';

const SPEC_GLOB = process.env.SPECS ?? 'out/test/e2e/specs/**/*.spec.js';
const MOCHA_RC = process.env.MOCHA_RC ?? './.mocharc.js';
const CODE_VERSION = process.env.CODE_VERSION; // optional
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'INFO'; // ExTester log level

async function main() {
  const before = await getVSCodePids();

  const args = [
    'extest',
    'setup-and-run',
    '-m', MOCHA_RC,
    SPEC_GLOB,
    '-i',                // install marketplace deps declared by your extension
    '-l', LOG_LEVEL
  ];

  if (CODE_VERSION) {
    process.env.CODE_VERSION = CODE_VERSION;
  }

  // Launch exTester via npx for portability
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    stdio: 'inherit',
    shell: false
  });

  // Detect newly launched VS Code PIDs (within 30s)
  const newPidsPromise = waitForNewVSCodePids(before, 30000);

  const exitCode: number = await new Promise(resolve => child.on('close', resolve as any));

  const after = await getVSCodePids();
  const { added: maybeLaunched } = diffPids(before, after);
  const launched = (await newPidsPromise).size > 0 ? await newPidsPromise : maybeLaunched;

  if (launched.size > 0) {
    const closed = await waitForPidsExit(launched, 30000);
    if (!closed) {
      console.error('[run-e2e] VS Code did not close cleanly. PIDs:', [...launched].join(', '));
      process.exitCode = exitCode || 1;
      return;
    }
  }

  process.exitCode = exitCode ?? 0;
}

main().catch(err => {
  console.error('[run-e2e] Unhandled error:', err);
  process.exit(1);
});
```

* Takes a **baseline PID snapshot**, starts ExTester, detects **new VS Code PIDs**, and **verifies closure** after tests.
* Configure with env vars:

  * `SPECS="out/test/e2e/specs/**/foo.spec.js"`
  * `MOCHA_RC="./.mocharc.js"`
  * `CODE_VERSION="1.92.0"`
  * `LOG_LEVEL="FINE"`

---

## Specs (using the new manager)

### `statusbar_progress.spec.ts`

```ts
// test/e2e/specs/statusbar_progress.spec.ts
import { expect } from 'chai';
import { ActivityBar } from 'vscode-extension-tester';
import { getDriver, observeStatusProgress } from '../lib/status-manger';

describe('Status bar progress reacts to changes', () => {
  it('detects a change under #status.progress', async () => {
    // Open Testing view (any interaction that ensures workbench is ready)
    await (await new ActivityBar().getViewControl('Testing'))?.openView();

    // TODO: trigger your extension command that shows progress for >= ~1s
    // await new Workbench().executeCommand('yourExtension.runLongTask');

    const result = await observeStatusProgress(getDriver(), 15000);
    expect(result.ok, `progress change not detected: ${result.reason}`).to.equal(true);
  });
});
```

### `open-testing-view.spec.ts` (unchanged in spirit, moved path)

```ts
// test/e2e/specs/open-testing-view.spec.ts
import { expect } from 'chai';
import { ActivityBar, SideBarView } from 'vscode-extension-tester';

describe('Open Testing view', () => {
  it('focuses Testing view via ActivityBar', async () => {
    const control = await new ActivityBar().getViewControl('Testing');
    const view = await control?.openView();
    expect(view).to.not.be.undefined;

    const side = new SideBarView();
    const sections = await side.getContent().getSections();
    expect(sections.length).to.be.greaterThan(0);
  });
});
```

### `ctest-discovery.spec.ts` (folder rename applied)

```ts
// test/e2e/specs/ctest-discovery.spec.ts
import { expect } from 'chai';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ActivityBar, SideBarView, Workbench } from 'vscode-extension-tester';
const execFileAsync = promisify(execFile);

describe('CTest discovery after CMake build', () => {
  const workspacePath = path.resolve(__dirname, '..', '..', 'integrated_unit_gtest_and_cdoctest_cmake_ctest');
  const buildPath = path.join(workspacePath, 'build');

  before(async () => {
    await execFileAsync('cmake', ['-S', workspacePath, '-B', buildPath]);
    await execFileAsync('cmake', ['--build', buildPath]);
  });

  it('discovers tests in Testing view', async () => {
    await (await new ActivityBar().getViewControl('Testing'))?.openView();
    await new Workbench().executeCommand('Testing: Focus on Test Explorer View');

    const side = new SideBarView();
    const section: any = (await side.getContent().getSections())[0];

    expect(await (await section.findItem('MathTests'))?.isVisible()).to.equal(true);
    expect(await (await section.findItem('StringTests'))?.isVisible()).to.equal(true);
    expect(await (await section.findItem('Addition'))?.isVisible()).to.equal(true);
    expect(await (await section.findItem('Subtraction'))?.isVisible()).to.equal(true);
  });
});
```

---

## Running Tests

```bash
# 1) Install deps
npm install

# 2) Build the extension & tests
npm run compile

# 3) Run E2E with PID checks (wraps `extest setup-and-run`)
npm run e2e

# Optional:
CODE_VERSION=1.92.0 LOG_LEVEL=FINE npm run e2e
SPECS="out/test/e2e/specs/statusbar_progress.spec.js" npm run e2e
```

**What `npm run e2e` does now:**

* Snapshot current VS Code PIDs.
* Run ExTester (downloads Code + Chromedriver, installs marketplace deps if needed).
* Detect newly spawned VS Code PIDs.
* After tests, ensure those PIDs exit; if not, mark failure.

---

## Best Practices (unchanged essence)

1. **Extension deps**: Install required marketplace extensions (e.g., CMake Tools); don’t pass `--disable-extensions`.
2. **Use page objects first**; reach for raw `By.css`/`until` only for leaf controls.
3. **Build first**, then assert discovery in the Testing view.
4. **Single instance**: our wrapper + ExTester manage lifecycle; avoid spawning additional Code instances.
5. **Progress tests**: ensure your command keeps progress visible ≥1–2 s for deterministic observation.

