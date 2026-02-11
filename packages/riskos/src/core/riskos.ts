/**
 * RiskOS core runtime
 */

import { randomUUID } from 'crypto';
import type { HazelContext, HazelEvent, HazelActor } from '@hazeljs/contracts';
import { NoopBus } from '../bus/noopBus';
import { MemoryEventBus } from '../bus/memoryBus';
import type { AuditSink } from '../audit/sink';
import { computeTraceHash } from '../audit/integrity/hashChain';
import { nowISO, nowMs } from '../utils/time';
import type { EventBus } from '../bus/eventBus';
import type { RiskOSConfig } from '../config';
import type { PolicyEngine } from '../compliance/policyEngine';
import type { CreateContextOptions } from '../types';
import type { ComplianceTrace } from '../audit/trace';
import { PolicyDeniedError } from './errors';
import type { RiskOSPlugin } from '../types';

/** RiskOS runtime */
export class RiskOSRuntime {
  private bus: EventBus;
  private auditSink?: AuditSink;
  private policyEngine?: PolicyEngine;
  private enforcePolicies = false;
  private appVersion?: string;
  private configHash?: string;
  private policyVersion?: string;
  private lastHash = 'genesis';

  constructor(config: RiskOSConfig) {
    this.bus = config.bus ?? new NoopBus();
    this.auditSink = config.auditSink;
    this.policyEngine = config.policyEngine;
    this.enforcePolicies = config.enforcePolicies ?? !!config.policyEngine;
    this.appVersion = config.appVersion;
    this.configHash = config.configHash;
    this.policyVersion = config.policyVersion;
  }

  /** Create request context */
  createContext(base?: CreateContextOptions | HazelContext): HazelContext {
    const requestId = (base && 'requestId' in base)
      ? (base as HazelContext).requestId
      : `req-${randomUUID()}`;
    const tenantId = (base && 'tenantId' in base) ? (base as { tenantId?: string }).tenantId : undefined;
    const actor = (base && 'actor' in base) ? (base as { actor?: HazelActor }).actor : undefined;
    const purpose = (base && 'purpose' in base) ? (base as { purpose?: string }).purpose : undefined;
    const baseTags = (base && 'tags' in base) ? (base as { tags?: Record<string, unknown> }).tags : undefined;
    const tags = baseTags ?? {};

    const ctx: HazelContext = {
      requestId,
      tenantId,
      actor,
      purpose,
      tags,
      emit: (event: HazelEvent) => {
        this.bus.publish(event);
      },
      metrics: {
        count: (name, value = 1, t) => {
          this.bus.publish({ type: 'metric', name, value: value ?? 1, tags: t });
        },
        timing: (name, ms, t) => {
          this.bus.publish({ type: 'span', name, durationMs: ms, status: 'ok', tags: t });
        },
      },
    };
    return ctx;
  }

  /** Execute action with policies, audit tracing, error handling */
  async run<T>(
    actionName: string,
    ctxBase: CreateContextOptions | HazelContext,
    fn: (ctx: HazelContext) => Promise<T> | T,
  ): Promise<T> {
    const ctx = this.createContext(ctxBase);
    const tsStart = nowISO();
    const startMs = nowMs();
    const dataAccessEvents: HazelEvent[] = [];
    const aiCallEvents: HazelEvent[] = [];
    const decisionEvents: HazelEvent[] = [];
    const policyResults: ComplianceTrace['policyResults'] = [];
    let lastEvent: HazelEvent | undefined;

    const wrappedEmit = (event: HazelEvent) => {
      lastEvent = event;
      if (event.type === 'dataAccess') dataAccessEvents.push(event);
      if (event.type === 'aiCall') aiCallEvents.push(event);
      if (event.type === 'decision') decisionEvents.push(event);
      ctx.emit(event);
    };

    const wrappedCtx: HazelContext = {
      ...ctx,
      emit: wrappedEmit,
    };

    if (this.enforcePolicies && this.policyEngine) {
      const beforeResults = await this.policyEngine.evaluateBefore({
        actionName,
        tenantId: ctx.tenantId,
        actor: ctx.actor,
        purpose: ctx.purpose,
      });
      for (const r of beforeResults) {
        policyResults.push({ policy: r.policy, result: r.result });
        if (r.result === 'DENY') {
          throw new PolicyDeniedError(r.message ?? 'Policy denied', r.policy);
        }
      }
    }

    let error: string | undefined;
    let result: T;
    try {
      result = await fn(wrappedCtx);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const tsEnd = nowISO();
      const durationMs = nowMs() - startMs;
      wrappedCtx.metrics.timing(`riskos.action.${actionName}`, durationMs, {
        status: error ? 'error' : 'ok',
      });

      if (this.auditSink) {
        const trace: ComplianceTrace = {
          requestId: ctx.requestId,
          tsStart,
          tsEnd,
          tenantId: ctx.tenantId,
          actor: ctx.actor,
          purpose: ctx.purpose,
          actionName,
          policyResults: policyResults.length ? policyResults : undefined,
          dataAccessEvents: dataAccessEvents.length ? dataAccessEvents : undefined,
          aiCallEvents: aiCallEvents.length ? aiCallEvents : undefined,
          decisionEvents: decisionEvents.length ? decisionEvents : undefined,
          error,
          integrity: {
            hash: '',
            prevHash: this.lastHash,
          },
          versions: this.appVersion || this.configHash || this.policyVersion
            ? { appVersion: this.appVersion, configHash: this.configHash, policyVersion: this.policyVersion }
            : undefined,
        };
        trace.integrity.hash = computeTraceHash(trace, this.lastHash);
        this.lastHash = trace.integrity.hash;
        await this.auditSink.write(trace);
      }
    }
    return result;
  }

  /** Subscribe to events */
  onEvent(handler: (event: HazelEvent) => void): () => void {
    return this.bus.subscribe(handler);
  }

  /** Get audit sink for evidence pack */
  getAuditSink(): AuditSink | undefined {
    return this.auditSink;
  }

  /** Get bus */
  getBus() {
    return this.bus;
  }
}

/** Create RiskOS - framework-agnostic factory */
export function createRiskOS(config: RiskOSConfig): RiskOSRuntime {
  return new RiskOSRuntime(config);
}

/** RiskOS plugin for HazelJS .use() - when app has use() */
export function riskosPlugin(config: RiskOSConfig): RiskOSPlugin {
  const runtime = createRiskOS(config);
  return {
    name: '@hazeljs/riskos',
    install(app: { use?: (plugin: RiskOSPlugin) => void }) {
      if (typeof (app as Record<string, unknown>).riskos === 'function') {
        (app as { riskos: (r: RiskOSRuntime) => void }).riskos(runtime);
      }
    },
  };
}
