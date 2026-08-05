/**
 * Opinionated Skillgate defaults (Agent OS–aligned).
 */

import type { SkillgateClassifyOptions, SkillgateOptions } from './types';

/** Default classification: reads free, writes need approval, no DELETE/admin. */
export const SKILLGATE_DEFAULT_CLASSIFY: Required<
  Pick<SkillgateClassifyOptions, 'writeRequiresApproval' | 'allowDestructive' | 'allowAdmin'>
> = {
  writeRequiresApproval: true,
  allowDestructive: false,
  allowAdmin: false,
};

/** Merge user options on top of production-safe defaults. */
export function defaultSkillgateOptions(partial: SkillgateOptions = {}): SkillgateOptions {
  return {
    warnAbove: 12,
    maxTools: 24,
    agentName: 'api-concierge',
    ...partial,
    include: {
      mode: 'opt-in',
      ...partial.include,
    },
    classify: {
      ...SKILLGATE_DEFAULT_CLASSIFY,
      ...partial.classify,
    },
  };
}
