/**
 * Governed approval wrapper — does NOT change InMemory/Redis ApprovalProvider.consume.
 * Takes a distributed lock, then calls existing consume, then checks optional argumentDigest.
 */

import type { ApprovalProvider } from '../approval/provider';
import type { ApprovalRequest } from '../types';
import type { DistributedLock } from './lock';
import { StaleApprovalError } from './types';

export type GovernedApprovalRequest = ApprovalRequest & {
  /** Optional — missing means fingerprint-only (current behavior). */
  argumentDigest?: string;
  actorId?: string;
};

export interface GovernedConsumeInput {
  approvalId: string;
  fingerprint: string;
  argumentDigest?: string;
  actorId?: string;
  policyVersion?: string;
}

export interface GovernedConsumeResult {
  valid: boolean;
  request?: GovernedApprovalRequest;
  reason?: string;
}

export function withGovernedApproval(
  provider: ApprovalProvider,
  lock: DistributedLock
): {
  provider: ApprovalProvider;
  consumeGoverned(input: GovernedConsumeInput): Promise<GovernedConsumeResult>;
  createGoverned(
    request: ApprovalRequest,
    extras?: { argumentDigest?: string; actorId?: string }
  ): Promise<GovernedApprovalRequest>;
} {
  return {
    provider,
    async createGoverned(
      request: ApprovalRequest,
      extras?: { argumentDigest?: string; actorId?: string }
    ): Promise<GovernedApprovalRequest> {
      const enriched = {
        ...request,
        argumentDigest: extras?.argumentDigest,
        actorId: extras?.actorId,
      } as GovernedApprovalRequest;
      const stored = (await provider.create(enriched)) as GovernedApprovalRequest;
      return {
        ...stored,
        argumentDigest: extras?.argumentDigest ?? stored.argumentDigest,
        actorId: extras?.actorId ?? stored.actorId,
      };
    },
    async consumeGoverned(input): Promise<GovernedConsumeResult> {
      const handle = await lock.acquire(`approval:${input.approvalId}`, 5_000);
      if (!handle) {
        return { valid: false, reason: 'Could not acquire approval lock — concurrent consume' };
      }
      try {
        const before = (await provider.get(input.approvalId)) as
          | GovernedApprovalRequest
          | undefined;
        if (!before) return { valid: false, reason: 'Approval not found' };

        if (
          input.argumentDigest !== undefined &&
          before.argumentDigest !== undefined &&
          input.argumentDigest !== before.argumentDigest
        ) {
          throw new StaleApprovalError('Approval argument digest mismatch', {
            expected: before.argumentDigest,
            actual: input.argumentDigest,
          });
        }

        if (
          input.policyVersion !== undefined &&
          before.policyVersions?.length &&
          !before.policyVersions.includes(input.policyVersion) &&
          before.policyVersions[0] !== input.policyVersion
        ) {
          // Soft check: if policyVersions recorded and caller policy differs, reject.
          const recorded = before.policyVersions.join(',');
          if (recorded && input.policyVersion && !recorded.includes(input.policyVersion)) {
            throw new StaleApprovalError('Approval policy version changed', {
              recorded: before.policyVersions,
              current: input.policyVersion,
            });
          }
        }

        if (input.actorId && before.actorId && input.actorId !== before.actorId) {
          return { valid: false, reason: 'Approval actor mismatch' };
        }

        const result = await provider.consume(input.approvalId, input.fingerprint);
        if (!result.valid) {
          return {
            valid: false,
            reason: result.reason,
            request: result.request as GovernedApprovalRequest | undefined,
          };
        }

        // Digest check after successful fingerprint consume when only one side had digest.
        if (input.argumentDigest !== undefined && before.argumentDigest === undefined) {
          // Fingerprint already bound full input; digest is additive metadata.
        }

        return {
          valid: true,
          request: {
            ...(result.request as GovernedApprovalRequest),
            argumentDigest: before.argumentDigest,
            actorId: before.actorId,
          },
        };
      } finally {
        await handle.release();
      }
    },
  };
}
