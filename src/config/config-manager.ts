import fs from 'node:fs';
import path from 'node:path';
import { AutotaskConfig, AutotaskConfigInput, AutotaskConfigSchema } from '../types/config.js';

export const DEFAULT_CONFIG: AutotaskConfig = AutotaskConfigSchema.parse({});

export class ConfigManager {
  private baseDir: string;
  private configPath: string;
  private currentConfig: AutotaskConfig;

  constructor(repoPath: string = process.cwd()) {
    this.baseDir = path.resolve(repoPath);
    this.configPath = path.join(this.baseDir, '.autotask', 'config.json');
    this.currentConfig = this.loadConfig();
  }

  public getConfig(): AutotaskConfig {
    return this.currentConfig;
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public loadConfig(): AutotaskConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const validated = AutotaskConfigSchema.parse(parsed);
        this.currentConfig = validated;
        return validated;
      }
    } catch (err) {
      console.warn(`[ConfigManager] Error reading config file at ${this.configPath}, using defaults.`, err);
    }
    this.currentConfig = DEFAULT_CONFIG;
    return this.currentConfig;
  }

  public saveConfig(configInput: Partial<AutotaskConfigInput>): AutotaskConfig {
    const merged = { ...this.currentConfig, ...configInput };
    const validated = AutotaskConfigSchema.parse(merged);
    
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.configPath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.configPath);

    this.currentConfig = validated;
    return validated;
  }

  public ensureExampleConfig(): void {
    const examplePath = path.join(this.baseDir, '.autotask', 'config.example.json');
    if (!fs.existsSync(examplePath)) {
      const dir = path.dirname(examplePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(examplePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    }
  }
}
