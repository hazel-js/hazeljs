import type { AICompletionRequest } from '../ai-enhanced.types';
import { messageContentToText } from '../utils/message-content';

/** Subset matcher for FakeModel.calls against golden metadata.expectedCalls. */
export interface ExpectedCallSlice {
  model?: string;
  messageRoles?: string[];
  toolNames?: string[];
  messageIncludes?: string;
}

export interface CallMatchFailure {
  callIndex: number;
  reason: string;
}

/**
 * Assert that recorded provider calls match expected slices (subset / order-preserving).
 * Extra recorded calls beyond `expected.length` are ignored.
 */
export function matchExpectedCalls(
  calls: AICompletionRequest[],
  expected: ExpectedCallSlice[]
): { ok: boolean; failures: CallMatchFailure[] } {
  const failures: CallMatchFailure[] = [];
  for (let i = 0; i < expected.length; i++) {
    const slice = expected[i];
    const call = calls[i];
    if (!call) {
      failures.push({ callIndex: i, reason: `missing call at index ${i}` });
      continue;
    }
    if (slice.model !== undefined && call.model !== slice.model) {
      failures.push({
        callIndex: i,
        reason: `model: expected ${slice.model}, got ${call.model ?? '(none)'}`,
      });
    }
    if (slice.messageRoles?.length) {
      const roles = call.messages.map((m) => m.role);
      const matches = slice.messageRoles.every((r, idx) => roles[idx] === r);
      if (!matches) {
        failures.push({
          callIndex: i,
          reason: `messageRoles: expected [${slice.messageRoles.join(',')}], got [${roles.join(',')}]`,
        });
      }
    }
    if (slice.toolNames?.length) {
      const names = (call.functions ?? []).map((f) => f.name);
      const missing = slice.toolNames.filter((n) => !names.includes(n));
      if (missing.length) {
        failures.push({
          callIndex: i,
          reason: `toolNames missing: ${missing.join(',')}`,
        });
      }
    }
    if (slice.messageIncludes) {
      const blob = call.messages
        .map((m) => (typeof m.content === 'string' ? m.content : messageContentToText(m.content)))
        .join('\n');
      if (!blob.includes(slice.messageIncludes)) {
        failures.push({
          callIndex: i,
          reason: `messageIncludes not found: ${slice.messageIncludes}`,
        });
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

export function parseExpectedCalls(metadata?: Record<string, unknown>): ExpectedCallSlice[] {
  const raw = metadata?.expectedCalls;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is ExpectedCallSlice => x !== null && typeof x === 'object');
}
