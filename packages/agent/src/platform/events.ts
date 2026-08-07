/**
 * Platform control-plane events — audit/billing primitives (Phase 3).
 * Append-only; never stores prompts, tool payloads, or secrets.
 */

import * as fs from 'fs';
import * as path from 'path';
import { nowIso, type ResourceKind } from './resources';

export type PlatformEventType =
  | 'AdmissionAllowed'
  | 'AdmissionDenied'
  | 'ResourceApplied'
  | 'ResourceReconciled'
  | 'ResourceDeleted'
  | 'PackageResolved'
  | 'DurableRunCorrelated'
  | 'BackendUnsupported';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  timestamp: string;
  kind?: ResourceKind | string;
  name?: string;
  namespace?: string;
  generation?: number;
  ready?: boolean;
  reason?: string;
  message?: string;
  /** Non-sensitive correlation attributes only. */
  attributes?: Record<string, string | number | boolean | undefined>;
}

export interface PlatformEventSink {
  emit(event: Omit<PlatformEvent, 'id' | 'timestamp'> & Partial<Pick<PlatformEvent, 'id' | 'timestamp'>>): void;
  list(filter?: { type?: PlatformEventType; kind?: string; name?: string; limit?: number }): PlatformEvent[];
}

function newId(): string {
  return `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class InMemoryPlatformEventSink implements PlatformEventSink {
  private readonly events: PlatformEvent[] = [];

  emit(
    event: Omit<PlatformEvent, 'id' | 'timestamp'> & Partial<Pick<PlatformEvent, 'id' | 'timestamp'>>
  ): void {
    this.events.push({
      id: event.id ?? newId(),
      timestamp: event.timestamp ?? nowIso(),
      type: event.type,
      kind: event.kind,
      name: event.name,
      namespace: event.namespace,
      generation: event.generation,
      ready: event.ready,
      reason: event.reason,
      message: event.message,
      attributes: event.attributes,
    });
  }

  list(filter?: {
    type?: PlatformEventType;
    kind?: string;
    name?: string;
    limit?: number;
  }): PlatformEvent[] {
    let out = [...this.events];
    if (filter?.type) out = out.filter((e) => e.type === filter.type);
    if (filter?.kind) out = out.filter((e) => e.kind === filter.kind);
    if (filter?.name) out = out.filter((e) => e.name === filter.name);
    const limit = filter?.limit ?? out.length;
    return out.slice(-limit);
  }
}

/** JSONL file sink — Cloud/audit can ship the same schema later. */
export class FilePlatformEventSink implements PlatformEventSink {
  private readonly memory = new InMemoryPlatformEventSink();

  constructor(private readonly filePath: string) {
    this.hydrate();
  }

  private hydrate(): void {
    if (!fs.existsSync(this.filePath)) return;
    const lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as PlatformEvent;
        this.memory.emit(parsed);
      } catch {
        /* skip bad lines */
      }
    }
  }

  emit(
    event: Omit<PlatformEvent, 'id' | 'timestamp'> & Partial<Pick<PlatformEvent, 'id' | 'timestamp'>>
  ): void {
    const full: PlatformEvent = {
      id: event.id ?? newId(),
      timestamp: event.timestamp ?? nowIso(),
      type: event.type,
      kind: event.kind,
      name: event.name,
      namespace: event.namespace,
      generation: event.generation,
      ready: event.ready,
      reason: event.reason,
      message: event.message,
      attributes: event.attributes,
    };
    this.memory.emit(full);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(full)}\n`);
  }

  list(filter?: {
    type?: PlatformEventType;
    kind?: string;
    name?: string;
    limit?: number;
  }): PlatformEvent[] {
    return this.memory.list(filter);
  }

  get path(): string {
    return this.filePath;
  }
}

export const DEFAULT_PLATFORM_EVENTS = path.join('.hazel', 'platform', 'events.jsonl');
