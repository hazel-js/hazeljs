/**
 * Durable local job store — survives daemon restart (cron / sleep re-arm).
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureHazelHome, hazelHome } from './paths';

export interface DurableJob {
  id: string;
  agentId: string;
  runAt: string;
  input?: string;
  kind: 'schedule' | 'sleep' | 'trigger';
  cron?: string;
  createdAt: string;
}

export class DurableJobStore {
  private readonly file: string;

  constructor(filePath?: string) {
    const home = ensureHazelHome(hazelHome());
    this.file = filePath ?? home.jobsPath;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (!fs.existsSync(this.file)) {
      fs.writeFileSync(this.file, '[]\n');
    }
  }

  list(): DurableJob[] {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8')) as DurableJob[];
    } catch {
      return [];
    }
  }

  save(jobs: DurableJob[]): void {
    fs.writeFileSync(this.file, JSON.stringify(jobs, null, 2) + '\n');
  }

  upsert(job: DurableJob): void {
    const jobs = this.list().filter((j) => j.id !== job.id);
    jobs.push(job);
    this.save(jobs);
  }

  remove(id: string): void {
    this.save(this.list().filter((j) => j.id !== id));
  }

  due(now = new Date()): DurableJob[] {
    const t = now.getTime();
    return this.list().filter((j) => new Date(j.runAt).getTime() <= t);
  }
}

/** Very small cron helper: supports hourly step hours and "M H * * *" daily. */
export function nextCronDate(cron: string, from = new Date()): Date {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }
  const [min, hour] = parts;
  if (hour.startsWith('*/')) {
    const n = Number(hour.slice(2)) || 1;
    return new Date(from.getTime() + n * 60 * 60 * 1000);
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const next = new Date(from);
    next.setHours(Number(hour), Number(min), 0, 0);
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
    return next;
  }
  return new Date(from.getTime() + 60 * 60 * 1000);
}
