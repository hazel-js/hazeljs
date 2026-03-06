/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileAuditTransport } from './file.transport';
import type { AuditEvent } from '../audit.types';

describe('FileAuditTransport', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-file-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const baseEvent: AuditEvent = {
    action: 'test.action',
    timestamp: '2025-01-01T00:00:00.000Z',
    result: 'success',
  };

  it('should create parent directory when ensureDir is true', () => {
    const subDir = path.join(tmpDir, 'nested', 'logs');
    const filePath = path.join(subDir, 'audit.jsonl');
    expect(fs.existsSync(subDir)).toBe(false);
    new FileAuditTransport({ filePath, ensureDir: true });
    expect(fs.existsSync(subDir)).toBe(true);
  });

  it('should write when ensureDir is false and directory already exists', () => {
    const filePath = path.join(tmpDir, 'audit.jsonl');
    const transport = new FileAuditTransport({ filePath, ensureDir: false });
    transport.log(baseEvent);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('test.action');
  });

  it('should append one JSON line per log with _type audit', () => {
    const filePath = path.join(tmpDir, 'audit.jsonl');
    const transport = new FileAuditTransport({ filePath });
    transport.log(baseEvent);
    transport.log({ ...baseEvent, action: 'second' });
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])._type).toBe('audit');
    expect(JSON.parse(lines[0]).action).toBe('test.action');
    expect(JSON.parse(lines[1]).action).toBe('second');
  });

  it('should use absolute path as-is', () => {
    const filePath = path.join(tmpDir, 'abs.jsonl');
    const transport = new FileAuditTransport({ filePath });
    transport.log(baseEvent);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('test.action');
  });

  it('should roll to new file when size exceeds maxSizeBytes', () => {
    const filePath = path.join(tmpDir, 'audit.jsonl');
    const transport = new FileAuditTransport({
      filePath,
      maxSizeBytes: 30,
    });
    // First log: write a line long enough that file size >= 30
    const bigEvent: AuditEvent = {
      ...baseEvent,
      metadata: { padding: 'x'.repeat(100) },
    };
    transport.log(bigEvent);
    const filesAfterFirst = fs.readdirSync(tmpDir);
    expect(filesAfterFirst).toHaveLength(1);
    // Second log should trigger roll (current file is over 30 bytes)
    transport.log({ ...baseEvent, action: 'after-roll' });
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThanOrEqual(2);
    const rolledFile = files.find((f) => {
      const content = fs.readFileSync(path.join(tmpDir, f), 'utf8');
      return content.includes('after-roll');
    });
    expect(rolledFile).toBeDefined();
    expect(rolledFile).not.toBe('audit.jsonl');
  });

  it('should use date suffix when rollDaily is true', () => {
    const filePath = path.join(tmpDir, 'audit.jsonl');
    const transport = new FileAuditTransport({ filePath, rollDaily: true });
    transport.log(baseEvent);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
    const expectedSuffix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    expect(files[0]).toContain(expectedSuffix);
    expect(fs.readFileSync(path.join(tmpDir, files[0]), 'utf8')).toContain('test.action');
  });
});
