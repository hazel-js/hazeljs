import { Service } from '@hazeljs/core';
import EventEmitter from 'eventemitter3';
import type {
  AssembledContext,
  ContextContributor,
  ContextContributorKind,
  ContextModuleOptions,
  ContextRequest,
} from './types';
import { CONTEXT_EVENTS } from './types';
import { ContextError } from './errors/context.error';
import { ContextPlanner } from './planner/context-planner';
import { ContextAssembler } from './assembly/context-assembler';
import {
  createCagContributor,
  createKagContributor,
  createMemoryContributor,
  createRagContributor,
} from './adapters/ports';

@Service()
export class ContextService {
  private readonly contributors = new Map<ContextContributorKind, ContextContributor>();
  private readonly options: ContextModuleOptions;
  private readonly assembler: ContextAssembler;
  private readonly localEmitter = new EventEmitter();
  private readonly externalEmitter?: ContextModuleOptions['eventEmitter'];

  constructor(options: ContextModuleOptions = {}) {
    this.options = options;
    this.assembler = new ContextAssembler({ maxTokens: options.maxTokens });
    this.externalEmitter = options.eventEmitter;

    if (options.contributors) {
      for (const c of options.contributors) {
        this.register(c);
      }
    }
    if (options.cag) this.register(createCagContributor(options.cag));
    if (options.rag) this.register(createRagContributor(options.rag));
    if (options.kag) this.register(createKagContributor(options.kag));
    if (options.memory) this.register(createMemoryContributor(options.memory));
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.localEmitter.on(event, listener);
    return this;
  }

  register(contributor: ContextContributor): void {
    this.contributors.set(contributor.kind, contributor);
  }

  listContributors(): ContextContributorKind[] {
    return [...this.contributors.keys()];
  }

  /**
   * Plan + invoke contributors + assemble a single context string for the LLM.
   */
  async assemble(request: ContextRequest): Promise<AssembledContext> {
    if (!request.tenantId?.trim()) {
      throw ContextError.tenantRequired();
    }
    if (this.contributors.size === 0) {
      throw ContextError.noContributors();
    }

    const planner = new ContextPlanner({
      strategy: this.options.strategy ?? 'auto',
      sources: this.options.sources,
      available: this.listContributors(),
    });
    const plan = planner.plan(request);
    this.emit(CONTEXT_EVENTS.PLANNED, { request, plan });

    if (plan.sources.length === 0) {
      throw ContextError.planEmpty();
    }

    const contributions = await Promise.all(
      plan.sources.map(async (kind) => {
        const contributor = this.contributors.get(kind);
        if (!contributor) {
          return null;
        }
        const started = Date.now();
        try {
          const result = await contributor.contribute(request);
          const contribution = {
            kind,
            text: result.text ?? '',
            evidence: result.evidence,
            fingerprint: result.fingerprint,
            confidence: result.confidence,
            latencyMs: Date.now() - started,
          };
          this.emit(CONTEXT_EVENTS.CONTRIBUTOR_OK, contribution);
          return contribution;
        } catch (err) {
          this.emit(CONTEXT_EVENTS.CONTRIBUTOR_FAILED, {
            kind,
            error: err instanceof Error ? err.message : String(err),
          });
          // Soft-fail individual contributors so assembly can continue
          return null;
        }
      })
    );

    const assembled = this.assembler.assemble(
      plan,
      contributions.filter((c): c is NonNullable<typeof c> => c !== null)
    );
    this.emit(CONTEXT_EVENTS.ASSEMBLED, {
      sourcesUsed: assembled.sourcesUsed,
      tokenEstimate: assembled.tokenEstimate,
    });
    return assembled;
  }

  private emit(event: string, payload: unknown): void {
    this.localEmitter.emit(event, payload);
    this.externalEmitter?.emit(event, payload);
  }
}
