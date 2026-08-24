/**
 * Transaction coordinator — replays compensation inverses newest-first.
 */

import type { ToolMetadata } from '@hazeljs/agent';
import type { EffectRecord } from '../effects/effect-kind';
import { findCompensateMethod } from '../effects/compensate.decorator';
import { AgentVmEventType, type AgentVmEventEmitter } from '../events/vm-event.types';
import type { EffectJournal } from '../journal/effect-journal';
import type { JournalEntry } from '../journal/journal-entry.types';
import { CompensationError } from './compensation-error';
import type { IQuarantineStore } from './quarantine-store';
import { InMemoryQuarantineStore } from './quarantine-store';

export interface TransactionCoordinatorOptions {
  journal: EffectJournal;
  quarantine?: IQuarantineStore;
  maxRetries?: number;
  retryDelayMs?: number;
  emit?: AgentVmEventEmitter;
  resolveAgentInstance?: (agentId: string) => unknown;
  resolveTool?: (agentId: string, toolPropertyKey: string) => ToolMetadata | undefined;
}

export interface UndoResult {
  runId: string;
  compensated: number;
  failed: number;
  quarantined: string[];
}

export class TransactionCoordinator {
  private readonly quarantine: IQuarantineStore;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: TransactionCoordinatorOptions) {
    this.quarantine = options.quarantine ?? new InMemoryQuarantineStore();
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 100;
  }

  /** Undo an entire run by compensating all reversible journal entries (newest first). */
  async undoRun(runId: string): Promise<UndoResult> {
    this.emit({
      type: AgentVmEventType.ATOMIC_UNDO_STARTED,
      runId,
      timestamp: new Date(),
      data: { runId },
    });

    const entries = await this.options.journal.listRun(runId);
    const toUndo = [...entries].reverse();

    let compensated = 0;
    let failed = 0;
    const quarantined: string[] = [];

    for (const entry of toUndo) {
      try {
        await this.compensateEntry(entry);
        compensated++;
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const qId = await this.quarantine.add(entry, errorMsg, this.maxRetries);
        quarantined.push(qId);
        this.emit({
          type: AgentVmEventType.COMPENSATION_FAILED,
          runId,
          branchId: entry.branchId,
          agentId: entry.agentId,
          timestamp: new Date(),
          data: { entryId: entry.id, toolName: entry.toolName, error: errorMsg, quarantineId: qId },
        });
      }
    }

    this.emit({
      type: AgentVmEventType.ATOMIC_UNDO_COMPLETED,
      runId,
      timestamp: new Date(),
      data: { runId, compensated, failed, quarantined },
    });

    return { runId, compensated, failed, quarantined };
  }

  /** Roll back a speculative branch — compensates branch-local entries only. */
  async rollbackBranch(branchId: string, runId: string): Promise<UndoResult> {
    const entries = await this.options.journal.listBranch(branchId);
    const toUndo = [...entries].reverse();

    let compensated = 0;
    let failed = 0;
    const quarantined: string[] = [];

    for (const entry of toUndo) {
      try {
        await this.compensateEntry(entry);
        compensated++;
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const qId = await this.quarantine.add(entry, errorMsg, this.maxRetries);
        quarantined.push(qId);
        this.emit({
          type: AgentVmEventType.COMPENSATION_FAILED,
          runId,
          branchId,
          agentId: entry.agentId,
          timestamp: new Date(),
          data: { entryId: entry.id, toolName: entry.toolName, error: errorMsg, quarantineId: qId },
        });
      }
    }

    await this.options.journal.clearBranch(branchId);

    this.emit({
      type: AgentVmEventType.SPECULATION_ROLLED_BACK,
      runId,
      branchId,
      timestamp: new Date(),
      data: { branchId, compensated, failed },
    });

    return { runId, compensated, failed, quarantined };
  }

  getQuarantineStore(): IQuarantineStore {
    return this.quarantine;
  }

  private async compensateEntry(entry: JournalEntry): Promise<void> {
    this.emit({
      type: AgentVmEventType.COMPENSATION_STARTED,
      runId: entry.runId,
      branchId: entry.branchId,
      agentId: entry.agentId,
      timestamp: new Date(),
      data: { entryId: entry.id, toolName: entry.toolName },
    });

    const agentInstance = this.options.resolveAgentInstance?.(entry.agentId);
    if (!agentInstance) {
      throw new CompensationError(
        `No agent instance for compensation: ${entry.agentId}`,
        entry.id,
        entry.toolName
      );
    }

    const toolMeta = this.options.resolveTool?.(entry.agentId, entry.toolPropertyKey);
    const compensateKey = entry.compensateMethod ?? entry.toolPropertyKey;
    const handler =
      findCompensateMethod(agentInstance, compensateKey) ??
      (toolMeta ? findCompensateMethod(agentInstance, toolMeta.propertyKey) : undefined);

    if (!handler) {
      throw new CompensationError(
        `No @Compensate handler for tool ${entry.toolName}`,
        entry.id,
        entry.toolName
      );
    }

    const record: EffectRecord = {
      entryId: entry.id,
      toolName: entry.toolName,
      agentId: entry.agentId,
      branchId: entry.branchId,
      runId: entry.runId,
      sessionId: entry.sessionId,
      input: entry.input,
      output: entry.output,
      timestamp: entry.createdAt,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await handler.method.call(agentInstance, record);
        await this.options.journal.markCompensated(entry.id);
        this.emit({
          type: AgentVmEventType.COMPENSATION_COMPLETED,
          runId: entry.runId,
          branchId: entry.branchId,
          agentId: entry.agentId,
          timestamp: new Date(),
          data: { entryId: entry.id, toolName: entry.toolName, attempt: attempt + 1 },
        });
        return;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    await this.options.journal.markFailed(entry.id, msg);
    throw new CompensationError(
      `Compensation failed for ${entry.toolName}: ${msg}`,
      entry.id,
      entry.toolName,
      lastError
    );
  }

  private emit(event: Parameters<AgentVmEventEmitter>[0]): void {
    this.options.emit?.(event);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
