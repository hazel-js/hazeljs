/**
 * KYC Engine - generic, config-driven
 */

import type { KycStore } from '../store/store';
import type { KycSession } from '../store/store';
import type { HttpProvider } from '../providers/httpProvider';
import { runAskStep } from './steps/ask';
import { runValidateStep } from './steps/validate';
import { runApiCallStep } from './steps/apiCall';
import { runTransformStep } from './steps/transform';
import { runVerifyStep } from './steps/verify';
import { runDecideStep } from './steps/decide';
import { set } from '../../utils/jsonpath';
import { KycValidationError } from '../../core/errors';
import type { AskStepConfig, AskResult } from './steps/ask';
import type { ValidateStepConfig } from './steps/validate';
import type { ApiCallStepConfig } from './steps/apiCall';
import type { TransformStepConfig } from './steps/transform';
import type { VerifyStepConfig } from './steps/verify';
import type { DecideStepConfig } from './steps/decide';

export type StepConfig =
  | { type: 'ask'; config: AskStepConfig }
  | { type: 'validate'; config: ValidateStepConfig }
  | { type: 'apiCall'; config: ApiCallStepConfig }
  | { type: 'transform'; config: TransformStepConfig }
  | { type: 'verify'; config: VerifyStepConfig }
  | { type: 'decide'; config: DecideStepConfig };

export interface KycFlowConfig {
  steps: StepConfig[];
}

export interface KycEngineOptions {
  store: KycStore;
  providers?: Record<string, HttpProvider>;
}

/** Chat-based onboarding planner - next prompt for UI */
export function nextChatTurn(session: KycSession, flowConfig: KycFlowConfig): AskResult | null {
  for (const step of flowConfig.steps) {
    if (step.type !== 'ask') continue;
    const res = runAskStep(session, step.config);
    if (res.message) return res;
  }
  return null;
}

/** KycEngine */
export class KycEngine {
  constructor(
    private readonly store: KycStore,
    private readonly providers: Record<string, HttpProvider> = {}
  ) {}

  async createSession(tenantId?: string): Promise<KycSession> {
    return this.store.create(tenantId);
  }

  async getSession(id: string): Promise<KycSession | null> {
    return this.store.get(id);
  }

  async answer(sessionId: string, path: string, value: unknown): Promise<KycSession | null> {
    const session = await this.store.get(sessionId);
    if (!session) return null;
    const answers = { ...session.answers };
    set(answers as Record<string, unknown>, path, value);
    return this.store.update(sessionId, { answers });
  }

  async validate(
    sessionId: string,
    config: ValidateStepConfig
  ): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
    const session = await this.store.get(sessionId);
    if (!session) return { valid: false, errors: [{ path: '', message: 'session not found' }] };
    return runValidateStep(session, config);
  }

  async runStep(
    sessionId: string,
    step: StepConfig,
    resolveSecret?: (key: string) => string | undefined
  ): Promise<KycSession | AskResult | null> {
    const session = await this.store.get(sessionId);
    if (!session) return null;

    if (step.type === 'ask') {
      return runAskStep(session, step.config);
    }
    if (step.type === 'validate') {
      const result = runValidateStep(session, step.config);
      if (!result.valid) throw new KycValidationError('Validation failed', result.errors);
      return session;
    }
    if (step.type === 'apiCall') {
      const updated = await runApiCallStep(session, step.config, this.providers, resolveSecret);
      return this.store.update(sessionId, updated);
    }
    if (step.type === 'transform') {
      const updated = runTransformStep(session, step.config);
      return this.store.update(sessionId, updated);
    }
    if (step.type === 'verify') {
      const updated = runVerifyStep(session, step.config);
      return this.store.update(sessionId, updated);
    }
    if (step.type === 'decide') {
      const updated = runDecideStep(session, step.config);
      return this.store.update(sessionId, updated);
    }
    return session;
  }

  async runFlow(
    sessionId: string,
    flowConfig: KycFlowConfig,
    resolveSecret?: (key: string) => string | undefined
  ): Promise<KycSession> {
    let session = await this.store.get(sessionId);
    if (!session) throw new Error('Session not found');

    for (const step of flowConfig.steps) {
      if (step.type === 'ask') continue;
      const res = await this.runStep(sessionId, step, resolveSecret);
      if (res && typeof res === 'object' && 'id' in res) {
        session = res as KycSession;
      }
    }
    return session;
  }
}
