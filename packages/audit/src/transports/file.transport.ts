/**
 * File audit transport — appends one JSON line per event. Supports rotation by size or by day.
 * Parent directory is created at startup (when ensureDir is true); the file itself is created on first audit event.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AuditTransport, AuditEvent } from '../audit.types';

export interface FileAuditTransportOptions {
  /** Base path, e.g. logs/audit.jsonl. With rollDaily, becomes logs/audit.2025-03-01.jsonl */
  filePath: string;
  /** Create parent directory if missing (default: true) */
  ensureDir?: boolean;
  /** Rotate when file exceeds this size (bytes). Default: no rotation. Example: 10 * 1024 * 1024 = 10MB */
  maxSizeBytes?: number;
  /** Use one file per day (filename gets .YYYY-MM-DD before extension). Default: false */
  rollDaily?: boolean;
}

function getDateSuffix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class FileAuditTransport implements AuditTransport {
  private readonly basePath: string;
  private readonly ensureDir: boolean;
  private readonly maxSizeBytes: number | undefined;
  private readonly rollDaily: boolean;

  /** Current write path (can change when rolling) */
  private currentPath: string;

  constructor(options: FileAuditTransportOptions) {
    this.basePath = path.isAbsolute(options.filePath)
      ? options.filePath
      : path.resolve(process.cwd(), options.filePath);
    this.ensureDir = options.ensureDir !== false;
    this.maxSizeBytes = options.maxSizeBytes;
    this.rollDaily = options.rollDaily ?? false;
    this.currentPath = this.resolveCurrentPath();
    // Create directory at startup so the path is visible before first event
    if (this.ensureDir) {
      const dir = path.dirname(this.currentPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private resolveCurrentPath(): string {
    if (!this.rollDaily) return this.basePath;
    const ext = path.extname(this.basePath);
    const base = this.basePath.slice(0, -ext.length);
    return `${base}.${getDateSuffix()}${ext}`;
  }

  private ensureCurrentPath(): void {
    if (this.ensureDir) {
      const dir = path.dirname(this.currentPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private shouldRollBySize(): boolean {
    if (this.maxSizeBytes == null) return false;
    if (!fs.existsSync(this.currentPath)) return false;
    try {
      const stat = fs.statSync(this.currentPath);
      return stat.size >= this.maxSizeBytes;
    } catch {
      return false;
    }
  }

  log(event: AuditEvent): void {
    if (this.rollDaily) {
      const next = this.resolveCurrentPath();
      if (next !== this.currentPath) this.currentPath = next;
    }
    if (this.shouldRollBySize()) {
      const ext = path.extname(this.basePath);
      const base = this.basePath.slice(0, -ext.length);
      this.currentPath = `${base}.${Date.now()}${ext}`;
    }

    this.ensureCurrentPath();
    const line = JSON.stringify({ ...event, _type: 'audit' }) + '\n';
    fs.appendFileSync(this.currentPath, line, 'utf8');
  }
}
