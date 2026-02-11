/**
 * KYC apiCall step - use HttpProvider + template resolver
 */

import { resolveTemplate, resolveTemplateDeep } from '../../../utils/template';
import { set } from '../../../utils/jsonpath';
import type { KycSession } from '../../store/store';
import type { HttpProvider } from '../../providers/httpProvider';
import type { HttpOperation } from '../../providers/templates';
import type { SecretResolver } from '../../providers/secrets';

export interface ApiCallStepConfig {
  provider: string;
  operation: HttpOperation;
  storeAt: string;
}

/** Run API call and store raw response */
export async function runApiCallStep(
  session: KycSession,
  config: ApiCallStepConfig,
  providers: Record<string, HttpProvider>,
  resolveSecret?: SecretResolver,
): Promise<KycSession> {
  const provider = providers[config.provider];
  if (!provider) throw new Error(`Provider ${config.provider} not found`);

  const state = {
    answers: session.answers,
    raw: session.raw,
    normalized: session.normalized,
  } as Record<string, unknown>;

  const op: HttpOperation = {
    ...config.operation,
    path: resolveTemplate(config.operation.path, state),
    body: config.operation.body
      ? (resolveTemplateDeep(config.operation.body, state) as Record<string, unknown>)
      : undefined,
    headers: config.operation.headers
      ? Object.fromEntries(
          Object.entries(config.operation.headers).map(([k, v]) => [
            k,
            resolveTemplate(String(v), state),
          ]),
        )
      : undefined,
    query: config.operation.query
      ? Object.fromEntries(
          Object.entries(config.operation.query).map(([k, v]) => [
            k,
            resolveTemplate(String(v), state),
          ]),
        )
      : undefined,
  };

  const raw = await provider.call(op, state, resolveSecret);
  const updates = { ...session.raw };
  set(updates as Record<string, unknown>, config.storeAt, raw);
  return { ...session, raw: updates };
}
