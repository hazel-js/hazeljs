import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { CONFIG_EXTENSIONS } from './types';
import { setNested } from './merge';

function coerce(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return raw;
}

export function parseProperties(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      continue;
    }
    const sep = trimmed.includes('=') ? '=' : trimmed.includes(':') ? ':' : '';
    if (!sep) continue;
    const idx = trimmed.indexOf(sep);
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    setNested(result, key, coerce(value));
  }
  return result;
}

export function parseConfigContent(content: string, filename: string): Record<string, unknown> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.json') {
    const parsed = JSON.parse(content) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Config file ${filename} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  }
  if (ext === '.yml' || ext === '.yaml') {
    const parsed = yaml.load(content);
    if (parsed == null) return {};
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Config file ${filename} must be a YAML mapping`);
    }
    return parsed as Record<string, unknown>;
  }
  if (ext === '.properties' || ext === '.env') {
    return parseProperties(content);
  }
  throw new Error(`Unsupported config file type: ${filename}`);
}

export function isConfigFile(filename: string): boolean {
  return (CONFIG_EXTENSIONS as readonly string[]).includes(path.extname(filename).toLowerCase());
}

export function readConfigFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseConfigContent(content, path.basename(filePath));
}
