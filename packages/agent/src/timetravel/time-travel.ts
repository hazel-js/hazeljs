/**
 * Agent OS Phase 2 — Time Travel Debugger
 * Replay timeline steps, edit prompt/tool output, continue from a fork point.
 */

import { randomUUID } from 'crypto';
import type { TimelineStep } from '../timeline/timeline.recorder';
import { AgentTimelineRecorder } from '../timeline/timeline.recorder';

export type TimeTravelEditKind = 'prompt' | 'tool_output' | 'thought' | 'metadata';

export interface TimeTravelEdit {
  stepId: string;
  kind: TimeTravelEditKind;
  /** Replacement value (string for prompt/thought; any for tool_output/metadata). */
  value: unknown;
}

export interface TimeTravelSnapshot {
  forkId: string;
  sourceExecutionId: string;
  steps: TimelineStep[];
  edits: TimeTravelEdit[];
  createdAt: string;
}

export interface ContinueFromOptions {
  /** Step index (0-based) or step id to continue after. Default: last step. */
  afterStepId?: string;
  afterIndex?: number;
  /** Optional new user input injected as the next turn. */
  input?: string;
}

/**
 * In-memory time-travel store: clone executions, apply edits, prepare continue payloads.
 */
export class TimeTravelDebugger {
  private forks = new Map<string, TimeTravelSnapshot>();

  constructor(private readonly timeline: AgentTimelineRecorder) {}

  /** Capture a mutable fork of an execution timeline. */
  fork(executionId: string): TimeTravelSnapshot {
    const steps = this.timeline.getTimeline({ executionId }).map((s) => ({
      ...s,
      data: (() => {
        try {
          return structuredClone(s.data);
        } catch {
          return JSON.parse(JSON.stringify(s.data ?? null));
        }
      })(),
    }));
    if (steps.length === 0) {
      throw new Error(`No timeline steps for execution ${executionId}`);
    }
    const snapshot: TimeTravelSnapshot = {
      forkId: randomUUID(),
      sourceExecutionId: executionId,
      steps,
      edits: [],
      createdAt: new Date().toISOString(),
    };
    this.forks.set(snapshot.forkId, snapshot);
    return snapshot;
  }

  getFork(forkId: string): TimeTravelSnapshot | undefined {
    return this.forks.get(forkId);
  }

  /** Edit a step on a fork (prompt, tool output, thought, or metadata). */
  edit(forkId: string, edit: TimeTravelEdit): TimeTravelSnapshot {
    const fork = this.forks.get(forkId);
    if (!fork) throw new Error(`Unknown fork ${forkId}`);

    const step = fork.steps.find((s) => s.id === edit.stepId);
    if (!step) throw new Error(`Step ${edit.stepId} not found on fork ${forkId}`);

    const data = (
      typeof step.data === 'object' && step.data !== null
        ? { ...(step.data as Record<string, unknown>) }
        : {}
    ) as Record<string, unknown>;

    switch (edit.kind) {
      case 'prompt':
        step.prompt = String(edit.value);
        data.input = edit.value;
        data.thought = edit.value;
        break;
      case 'thought':
        step.prompt = String(edit.value);
        data.thought = edit.value;
        break;
      case 'tool_output':
        data.output = edit.value;
        data.toolResult = edit.value;
        break;
      case 'metadata':
        data.metadata = edit.value;
        break;
    }
    step.data = data;
    fork.edits.push(edit);
    return fork;
  }

  /**
   * Build a continue payload from a fork — caller passes to runtime.execute / resume.
   * Does not re-run history; supplies edited context for the next execute call.
   */
  prepareContinue(
    forkId: string,
    options: ContinueFromOptions = {}
  ): {
    forkId: string;
    sourceExecutionId: string;
    input: string;
    metadata: Record<string, unknown>;
    stepsBeforeContinue: TimelineStep[];
  } {
    const fork = this.forks.get(forkId);
    if (!fork) throw new Error(`Unknown fork ${forkId}`);

    let cut = fork.steps.length;
    if (options.afterStepId) {
      const idx = fork.steps.findIndex((s) => s.id === options.afterStepId);
      if (idx < 0) throw new Error(`Step ${options.afterStepId} not found`);
      cut = idx + 1;
    } else if (typeof options.afterIndex === 'number') {
      cut = Math.max(0, Math.min(fork.steps.length, options.afterIndex + 1));
    }

    const stepsBeforeContinue = fork.steps.slice(0, cut);
    const last = stepsBeforeContinue[stepsBeforeContinue.length - 1];
    const lastData = (last?.data ?? {}) as Record<string, unknown>;

    const input =
      options.input ??
      (typeof lastData.input === 'string'
        ? lastData.input
        : typeof last?.prompt === 'string'
          ? last.prompt
          : '');

    return {
      forkId,
      sourceExecutionId: fork.sourceExecutionId,
      input,
      metadata: {
        timeTravel: {
          forkId,
          sourceExecutionId: fork.sourceExecutionId,
          edits: fork.edits,
          continueAfter: last?.id,
        },
      },
      stepsBeforeContinue,
    };
  }

  /** Replay steps as a read-only report (no side effects). */
  replay(executionId: string): TimelineStep[] {
    return this.timeline.getTimeline({ executionId });
  }

  clear(): void {
    this.forks.clear();
  }
}
