import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface StateRecord {
  timestamp: number;
  message: string;
  type: StateType;
  event?: StateEvent;
  step: number;
  details?: any;
}
export enum StateType {
  STATUS,
  ACTION,
  NOTIFICATION
}
export enum StateEvent {
  // CMake Configuration Events
  CMAKE_CONFIG_PROGRESS = 'CMAKE_CONFIG_PROGRESS',
  CMAKE_CONFIG_SUCCESS = 'CMAKE_CONFIG_SUCCESS',
  CMAKE_CONFIG_FAIL = 'CMAKE_CONFIG_FAIL',
  
  // CMake Build Events
  CMAKE_BUILD_PROGRESS = 'CMAKE_BUILD_PROGRESS',
  CMAKE_BUILD_SUCCESS = 'CMAKE_BUILD_SUCCESS',
  CMAKE_BUILD_FAIL = 'CMAKE_BUILD_FAIL',
  
  // CMake Clean Events
  CMAKE_CLEAN_PROGRESS = 'CMAKE_CLEAN_PROGRESS',
  CMAKE_CLEAN_SUCCESS = 'CMAKE_CLEAN_SUCCESS',
  CMAKE_CLEAN_FAIL = 'CMAKE_CLEAN_FAIL',
  
  // Toolkit Selection Events
  CMAKE_SELECT_KIT_PROGRESS = 'CMAKE_SELECT_KIT_PROGRESS',
  CMAKE_SELECT_KIT_SUCCESS = 'CMAKE_SELECT_KIT_SUCCESS',
  CMAKE_SELECT_KIT_FAIL = 'CMAKE_SELECT_KIT_FAIL',
  
  // Extension Events
  EXTENSION_LOADED = 'EXTENSION_LOADED',
  EXTENSION_FAIL = 'EXTENSION_FAIL',
  
  // Test Explorer Events
  TEST_EXPLORER_OPENED = 'TEST_EXPLORER_OPENED',
  TEST_EXPLORER_POPULATED = 'TEST_EXPLORER_POPULATED',
  
  // General Events
  VSCODE_READY = 'VSCODE_READY',
  PROGRESS_START = 'PROGRESS_START',
  PROGRESS_END = 'PROGRESS_END',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export class StateMonitor {
  private records: StateRecord[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private page: Page | null = null;
  private lastStatusBar: string = '';
  private stepCounter: number = 0;
  private wasProgress: boolean = false;
  private consoleCapture: string[] = [];
  private verbose: boolean;
  private logFilePath: string | null = null;
  private consoleLogPath: string | null = null;
  private lastConsoleCaptureLen: number = 0;

  constructor(verbose: boolean = false) {
    // Use array which is thread-safe for push operations in Node.js
    this.records = [];
    this.stepCounter = 0;
    this.verbose = verbose;
    
    // Initialize log files if verbose mode is enabled
    if (this.verbose) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logDir = path.join(__dirname, '..', 'logs');
      
      // Create log directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      this.logFilePath = path.join(logDir, `state-monitor-${timestamp}.log`);
      this.consoleLogPath = path.join(logDir, `console-capture-${timestamp}.log`);
      
      // Initialize log files
      fs.writeFileSync(this.logFilePath, `=== State Monitor Log Started at ${new Date().toISOString()} ===\n`);
      fs.writeFileSync(this.consoleLogPath, `=== Console Capture Log Started at ${new Date().toISOString()} ===\n`);
      
      console.log(`[StateMonitor] Verbose logging enabled. Logs will be written to:`);
      console.log(`  Records: ${this.logFilePath}`);
      console.log(`  Console: ${this.consoleLogPath}`);

    }
  }
  async tryUpdateStatus()  {
      if (!this.isMonitoring || !this.page) return;
      if (this.verbose && this.consoleCapture.length > this.lastConsoleCaptureLen) {
        fs.appendFileSync(this.consoleLogPath!, this.consoleCapture.join('\n') + '\n');
        this.lastConsoleCaptureLen = this.consoleCapture.length;
      }

      try {
        // Monitor status bar changes
        const statusBarItems = await this.page.$$eval('.statusbar-item', elements => 
          elements.map(el => el.textContent?.trim() || '').filter(text => text.length > 0)
        );
        const currentStatusBar = statusBarItems.join(' ');
        
        if (currentStatusBar !== this.lastStatusBar) {
          if (this.wasProgress) {
            const lastFiveLines: string[] = this.consoleCapture.slice(-5);
            this.wasProgress = false;
            let wasSuccess = false;
            for (const line of lastFiveLines) {
              if (line.includes('exit code 0')) {
                wasSuccess = true;
                break;
              }
            }
            if (wasSuccess) {
              if (this.records[this.records.length - 1].event === StateEvent.CMAKE_CONFIG_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake configuration completed successfully', StateEvent.CMAKE_CONFIG_SUCCESS);
              } else if (this.records[this.records.length - 1].event === StateEvent.CMAKE_BUILD_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake operation completed successfully', StateEvent.CMAKE_BUILD_SUCCESS);
              } else if (this.records[this.records.length - 1].event === StateEvent.CMAKE_CLEAN_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake clean completed successfully', StateEvent.CMAKE_CLEAN_SUCCESS);
              }
            } else {
              if (this.records[this.records.length - 1].event === StateEvent.CMAKE_CONFIG_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake configuration failed', StateEvent.CMAKE_CONFIG_FAIL);
              } else if (this.records[this.records.length - 1].event === StateEvent.CMAKE_BUILD_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake operation failed', StateEvent.CMAKE_BUILD_FAIL);
              } else if (this.records[this.records.length - 1].event === StateEvent.CMAKE_CLEAN_PROGRESS) {
                this.addRecord(StateType.STATUS, 'CMake clean failed', StateEvent.CMAKE_CLEAN_FAIL);
              }
            }
          }
          this.addRecord(StateType.STATUS, `Status bar: ${currentStatusBar.substring(0, 150)}`);
          console.log(`Status bar: ${currentStatusBar}`);
          this.lastStatusBar = currentStatusBar;
          
          // Detect specific CMake events
          this.detectEvents(currentStatusBar);
        }
        
      } catch (error) {
        // Silently ignore errors during monitoring (element might not exist)
      }
    }
  
  /**
   * Start monitoring VS Code state changes
   */
  async startMonitoring(page: Page, consoleLogRegister: (messageStorage: string[]) => void, intervalMs: number = 50): Promise<void> {
    this.page = page;
    this.isMonitoring = true;
    
    this.addRecord(StateType.STATUS, 'Started monitoring VS Code state');
    consoleLogRegister(this.consoleCapture);

    // Set up interval to check for state changes
    this.monitoringInterval = setInterval(this.tryUpdateStatus, intervalMs);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.addRecord(StateType.STATUS, 'Stopped monitoring VS Code state');
  }
  
  /**
   * Get next step number
   */
  private getNextStep(): number {
    return ++this.stepCounter;
  }
  
  /**
   * Add a record to the thread-safe list
   */
  addRecord(type: StateType, message: string, event?: StateEvent): void {
    const record: StateRecord = {
      timestamp: Date.now(),
      message,
      type,
      event,
      step: this.getNextStep()
    };
    
    // Array.push is atomic in Node.js, making it thread-safe
    this.records.push(record);
    
    // Log to file if verbose mode is enabled
    if (this.verbose && this.logFilePath) {
      const timestamp = new Date(record.timestamp).toISOString();
      const logEntry = `[${timestamp}] [Step ${record.step}] [${StateType[record.type]}] ${record.event ? `[${record.event}] ` : ''}${record.message}\n`;
      fs.appendFileSync(this.logFilePath, logEntry);
    }
  }
  
  /**
   * Detect specific events from status bar text
   */
  private detectEvents(statusBarText: string): void {
    const lowerText = statusBarText.toLowerCase();
    if (lowerText.includes('cmake')) {
      const isProgress = lowerText.includes('progress');
      if (isProgress) {
        this.wasProgress = true;
        if (lowerText.includes('configuration')) {
          this.addRecord(StateType.STATUS, 'CMake configuration in progress', StateEvent.CMAKE_CONFIG_PROGRESS);
        } else if (lowerText.includes('build')) {
          this.addRecord(StateType.STATUS, 'CMake build in progress', StateEvent.CMAKE_BUILD_PROGRESS);
        } else if (lowerText.includes('clean')) {
          this.addRecord(StateType.STATUS, 'CMake clean in progress', StateEvent.CMAKE_CLEAN_PROGRESS);
        }
      }
    }
  }

  /**
   * Record a VS Code action
   */
  async recordAction(action: string, event?: StateEvent): Promise<number> {
    this.addRecord(StateType.ACTION, action, event);
    return this.stepCounter;
  }

  async recordStateChangeAction(action: string, event?: StateEvent): Promise<number> {
    this.addRecord(StateType.ACTION, action, event);
    await this.waitIdle();
    this.tryUpdateStatus();
    return this.stepCounter;
  }
  
  /**
   * Check if an event happened after a specific step (immediate check)
   */
  wasHappen(event: StateEvent, afterStep: number): boolean {
    return this.records.some(r => r.event === event && r.step > afterStep);
  }
  
  /**
   * Wait until idle then check if an event happened after a specific step
   */
  async wasHappenAfterIdle(event: StateEvent, afterStep: number, timeoutMs: number = 30000): Promise<boolean> {
    // Then check if the EXACT event happened (not just progress)
    this.tryUpdateStatus();
    if (this.wasHappen(event, afterStep)) {
      return true;
    }

    // First wait until system is idle
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const idle = await this.isIdle();
      this.tryUpdateStatus();
      if (this.wasHappen(event, afterStep)) {
        return true;
      }
      if (idle) {
        break;
      }
    }
    
    if (this.wasHappen(event, afterStep)) {
      return true;
    }

    return false;
  }

  
  /**
   * Get current step number
   */
  getCurrentStep(): number {
    return this.stepCounter;
  }
  
  /**
   * Check if system is idle (no progress for 2 seconds)
   */
  async isIdle(): Promise<boolean> {
    let lastStateCount = this.records.length;
    if (this.wasProgress) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (this.wasProgress || lastStateCount !== this.records.length || this.records.length === 0 || this.records[this.records.length - 1].type === StateType.STATUS) {
      return false;
    }

    return true;
  }

  async waitIdle(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    while (!await this.isIdle()) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (Date.now() - startTime > timeoutMs) {
        this.addRecord(StateType.STATUS, 'Wait for idle timed out');
        return false;
      }
    }
    this.addRecord(StateType.STATUS, 'System is idle');
    return true;
  }

  /**
   * Get all records
   */
  getRecords(): ReadonlyArray<StateRecord> {
    return [...this.records]; // Return a copy to prevent external modification
  }
  

  
  /**
   * Get records after a specific timestamp
   */
  getRecordsAfter(timestamp: number): ReadonlyArray<StateRecord> {
    return this.records.filter(r => r.timestamp > timestamp);
  }
  
  /**
   * Get records within a time range
   */
  getRecordsInRange(startTime: number, endTime: number): ReadonlyArray<StateRecord> {
    return this.records.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
  }
  
  /**
   * Clear all records
   */
  clearRecords(): void {
    this.records = [];
    this.addRecord(StateType.STATUS, 'Records cleared');
  }
  
  /**
   * Get formatted summary of all records
   */
  getSummary(): string {
    const summary: string[] = ['=== State Monitor Summary ==='];
    
    this.records.forEach(record => {
      const time = this.getFormattedTime(record.timestamp);
      const typeLabel = record.type;
      summary.push(`[${time}] ${typeLabel} ${record.message}`);
    });
    
    summary.push(`=== Total Records: ${this.records.length} ===`);
    return summary.join('\n');
  }
  
  /**
   * Wait for a specific event to occur
   */
  async waitForEvent(
    event: StateEvent, 
    timeoutMs: number = 30000, 
    afterStep: number = 0
  ): Promise<boolean> {
    const startTime = Date.now();
    
    // First check if event already happened
    let found = this.wasHappen(event, afterStep);
    
    if (found) {
      return true;
    } else {
      // Loop with timeout while not idle
      while (Date.now() - startTime < timeoutMs) {
        // Check if VS Code page is still alive
        if (this.page) {
          try {
            await this.page.evaluate(() => document.title);
          } catch (error) {
            return false;
          }
        }
        
        const idle = await this.isIdle();
        if (idle) {
          break; // Exit loop if system is idle
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check again after loop
      found = this.wasHappen(event, afterStep);
      
      if (found) {
        return true;
      }
    }
    
    if (!found) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Format timestamp to readable time
   */
  private getFormattedTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  }
  
  /**
   * Export records to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.records, null, 2);
  }
  
  /**
   * Get statistics about recorded states
   */
  getStatistics(): {
    totalRecords: number;
    byType: Record<string, number>;
    duration: number;
    avgRecordsPerSecond: number;
  } {
    const stats = {
      totalRecords: this.records.length,
      byType: {} as Record<string, number>,
      duration: 0,
      avgRecordsPerSecond: 0
    };
    
    // Count by type
    this.records.forEach(r => {
      stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
    });
    
    // Calculate duration
    if (this.records.length > 1) {
      stats.duration = this.records[this.records.length - 1].timestamp - this.records[0].timestamp;
      stats.avgRecordsPerSecond = (stats.totalRecords / (stats.duration / 1000));
    }
    
    return stats;
  }
}