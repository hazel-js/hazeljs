/**
 * Optional persistent timeline store (file-backed) for production debugging.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TimelineStep } from '../timeline/timeline.recorder';
import { AgentTimelineRecorder } from '../timeline/timeline.recorder';

export interface TimelineStore {
  append(step: TimelineStep): void | Promise<void>;
  load(filter: {
    agentName?: string;
    executionId?: string;
  }): TimelineStep[] | Promise<TimelineStep[]>;
  clear(): void | Promise<void>;
}

/** JSONL file store — one line per timeline step. */
export class FileTimelineStore implements TimelineStore {
  constructor(private readonly filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
  }

  append(step: TimelineStep): void {
    fs.appendFileSync(this.filePath, `${JSON.stringify(step)}\n`);
  }

  load(filter: { agentName?: string; executionId?: string }): TimelineStep[] {
    if (!fs.existsSync(this.filePath)) return [];
    const lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
    const steps: TimelineStep[] = [];
    for (const line of lines) {
      try {
        const step = JSON.parse(line) as TimelineStep;
        if (filter.executionId && step.executionId !== filter.executionId) continue;
        if (filter.agentName && step.agentId !== filter.agentName) continue;
        steps.push(step);
      } catch {
        // skip bad lines
      }
    }
    return steps;
  }

  clear(): void {
    fs.writeFileSync(this.filePath, '');
  }
}

/** Attach a store to an in-memory recorder (dual-write). */
export function attachTimelineStore(
  recorder: AgentTimelineRecorder,
  store: TimelineStore
): () => void {
  return recorder.subscribe((step) => {
    void store.append(step);
  });
}
