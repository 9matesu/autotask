import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { OpenCodeAdapter } from '../opencode/adapter.js';
import { AutotaskConfig } from '../types/config.js';

const execAsync = promisify(exec);

export interface DiagnosticItem {
  name: string;
  ok: boolean;
  message: string;
  details?: string;
}

export interface DoctorReport {
  overallOk: boolean;
  items: DiagnosticItem[];
}

export class DoctorService {
  private adapter: OpenCodeAdapter;
  private config: AutotaskConfig;
  private workingDir: string;

  constructor(adapter: OpenCodeAdapter, config: AutotaskConfig, workingDir: string = process.cwd()) {
    this.adapter = adapter;
    this.config = config;
    this.workingDir = workingDir;
  }

  public async runDiagnostics(): Promise<DoctorReport> {
    const items: DiagnosticItem[] = [];

    // 1. Node.js Check
    const nodeVer = process.version;
    const major = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
    items.push({
      name: 'Node.js',
      ok: major >= 20,
      message: major >= 20 ? `${nodeVer} (Supported)` : `${nodeVer} (Node 20+ required)`,
    });

    // 2. Git CLI Check
    try {
      const { stdout } = await execAsync('git --version');
      items.push({
        name: 'Git CLI',
        ok: true,
        message: stdout.trim(),
      });
    } catch {
      items.push({
        name: 'Git CLI',
        ok: false,
        message: 'Git is not installed or not in PATH',
      });
    }

    // 3. Repository Check
    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workingDir });
      items.push({
        name: 'Repository',
        ok: stdout.trim() === 'true',
        message: stdout.trim() === 'true' ? `Valid Git repository at ${this.workingDir}` : 'Not a Git repository',
      });
    } catch {
      items.push({
        name: 'Repository',
        ok: false,
        message: `Directory ${this.workingDir} is not a valid Git repository`,
      });
    }

    // 4. OpenCode CLI Check
    try {
      const health = await this.adapter.checkHealth();
      items.push({
        name: 'OpenCode CLI',
        ok: health.installed,
        message: health.installed ? `Installed (${health.version})` : (health.error || 'Not installed or failed'),
      });
    } catch (err: any) {
      items.push({
        name: 'OpenCode CLI',
        ok: false,
        message: err.message || 'Check failed',
      });
    }

    // 5. Autotask State & Write Permissions
    try {
      const testDir = path.join(this.workingDir, '.autotask');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      const testFile = path.join(testDir, `.write-test-${Date.now()}`);
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      items.push({
        name: 'Permissions & Storage',
        ok: true,
        message: `Write access confirmed for .autotask/`,
      });
    } catch (err: any) {
      items.push({
        name: 'Permissions & Storage',
        ok: false,
        message: `Failed to write to .autotask/: ${err.message}`,
      });
    }

    // 6. Configuration Check
    items.push({
      name: 'Configuration',
      ok: true,
      message: `Agent: ${this.config.opencode.agent} | Retries: ${this.config.retry.maxAttempts} | AutoCommit: ${this.config.git.autoCommit ? 'ON' : 'OFF'}`,
    });

    const overallOk = items.every((i) => i.ok);
    return { overallOk, items };
  }
}
