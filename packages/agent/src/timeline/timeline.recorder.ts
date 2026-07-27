/**
 * In-memory timeline recorder for Visual Reasoning Timeline / Inspector SSE.
 */

import { AgentEvent, AgentEventType } from '../types/event.types';

export interface TimelineStep {
  id: string;
  agentId: string;
  executionId: string;
  type: string;
  timestamp: string;
  durationMs?: number;
  state?: string;
  prompt?: string;
  tokens?: number;
  cost?: number;
  confidence?: number;
  data: unknown;
}

const MAX_STEPS_PER_EXECUTION = 500;
const MAX_EXECUTIONS = 200;

export class AgentTimelineRecorder {
  private byExecution: Map<string, TimelineStep[]> = new Map();
  private agentIndex: Map<string, Set<string>> = new Map();
  private order: string[] = [];
  private listeners: Set<(step: TimelineStep) => void> = new Set();

  subscribe(listener: (step: TimelineStep) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  record(event: AgentEvent): void {
    const executionId = event.executionId || 'unknown';
    const step: TimelineStep = {
      id: `${executionId}:${event.type}:${event.timestamp?.getTime?.() ?? Date.now()}`,
      agentId: event.agentId,
      executionId,
      type: event.type,
      timestamp: (event.timestamp instanceof Date ? event.timestamp : new Date()).toISOString(),
      data: event.data,
    };

    const data = event.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.duration === 'number') step.durationMs = data.duration;
      if (typeof data.newState === 'string') step.state = data.newState;
      if (typeof data.state === 'string') step.state = data.state;
      if (typeof data.score === 'number') step.confidence = data.score;
      if (typeof data.tokens === 'number') step.tokens = data.tokens;
      if (typeof data.cost === 'number') step.cost = data.cost;
      if (typeof data.thought === 'string') step.prompt = data.thought;
      if (typeof data.input === 'string' && event.type === AgentEventType.EXECUTION_STARTED) {
        step.prompt = data.input;
      }
    }

    let list = this.byExecution.get(executionId);
    if (!list) {
      list = [];
      this.byExecution.set(executionId, list);
      this.order.push(executionId);
      while (this.order.length > MAX_EXECUTIONS) {
        const old = this.order.shift();
        if (old) this.byExecution.delete(old);
      }
    }
    list.push(step);
    if (list.length > MAX_STEPS_PER_EXECUTION) {
      list.splice(0, list.length - MAX_STEPS_PER_EXECUTION);
    }

    if (event.agentId) {
      let set = this.agentIndex.get(event.agentId);
      if (!set) {
        set = new Set();
        this.agentIndex.set(event.agentId, set);
      }
      set.add(executionId);
    }

    for (const listener of this.listeners) {
      try {
        listener(step);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  getTimeline(filter: { agentName?: string; executionId?: string }): TimelineStep[] {
    if (filter.executionId) {
      return [...(this.byExecution.get(filter.executionId) ?? [])];
    }
    if (filter.agentName) {
      const ids = this.agentIndex.get(filter.agentName);
      if (!ids) return [];
      const steps: TimelineStep[] = [];
      for (const id of ids) {
        steps.push(...(this.byExecution.get(id) ?? []));
      }
      return steps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    const all: TimelineStep[] = [];
    for (const id of this.order) {
      all.push(...(this.byExecution.get(id) ?? []));
    }
    return all;
  }

  clear(): void {
    this.byExecution.clear();
    this.agentIndex.clear();
    this.order = [];
  }
}
