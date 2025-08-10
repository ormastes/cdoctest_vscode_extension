import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class VSCodeManager {
  private static runningProcesses: Set<number> = new Set();

  /**
   * Register a VS Code process PID for tracking
   */
  static registerProcess(pid: number) {
    console.log(`Registered VS Code process: ${pid}`);
    this.runningProcesses.add(pid);
  }
  
  /**
   * Get all tracked process PIDs
   */
  static getTrackedProcesses(): number[] {
    return Array.from(this.runningProcesses);
  }

  /**
   * Kill a specific VS Code process by PID
   */
  static async killProcess(pid: number): Promise<boolean> {
    try {
      // Check if process exists first
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" 2>nul`);
      if (!stdout.includes(pid.toString())) {
        console.log(`Process ${pid} not found, removing from tracking`);
        this.runningProcesses.delete(pid);
        return false;
      }
      
      // Try graceful shutdown first
      await execAsync(`taskkill /PID ${pid} /T`).catch(() => {
        // If graceful fails, force kill
        return execAsync(`taskkill /PID ${pid} /T /F`);
      });
      
      this.runningProcesses.delete(pid);
      console.log(`Killed VS Code process: ${pid}`);
      return true;
    } catch (error) {
      console.log(`Failed to kill process ${pid}:`, error);
      this.runningProcesses.delete(pid);
      return false;
    }
  }

  /**
   * Kill only tracked VS Code processes (opened by tests)
   */
  static async killTrackedProcesses(): Promise<void> {
    if (this.runningProcesses.size === 0) {
      console.log('No tracked VS Code processes to kill');
      return;
    }
    
    console.log(`Killing ${this.runningProcesses.size} tracked VS Code processes...`);
    
    const killPromises: Promise<boolean>[] = [];
    for (const pid of this.runningProcesses) {
      killPromises.push(this.killProcess(pid));
    }
    
    await Promise.all(killPromises);
    console.log('All tracked VS Code processes terminated');
  }

  /**
   * Clean up only tracked processes (opened by tests)
   */
  static async cleanup(): Promise<void> {
    await this.killTrackedProcesses();
  }

  /**
   * Check if VS Code is running
   */
  static async isVSCodeRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Code.exe" 2>nul');
      return stdout.includes('Code.exe');
    } catch {
      return false;
    }
  }

  /**
   * Wait for VS Code to close
   */
  static async waitForVSCodeToClose(maxWaitMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (!(await this.isVSCodeRunning())) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
}