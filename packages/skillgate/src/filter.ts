/**
 * Include / deny filtering for Skillgate.
 */

import type { ParsedOperation, SkillgateIncludeOptions, XHazelSkill } from './types';

const DEFAULT_OPT_IN_TAGS = ['agent', 'skillgate'];

function resolveXHazel(raw?: XHazelSkill | boolean): XHazelSkill | undefined {
  if (raw === undefined || raw === false) return undefined;
  if (raw === true) return { enabled: true };
  return raw;
}

function isXHazelEnabled(raw?: XHazelSkill | boolean): boolean {
  const x = resolveXHazel(raw);
  if (!x) return false;
  return x.enabled !== false;
}

function matchesAny(value: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((p) => {
    if (typeof p === 'string') {
      if (p.includes('*')) {
        const re = new RegExp(
          '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
        );
        return re.test(value);
      }
      return value === p || value.includes(p);
    }
    return p.test(value);
  });
}

export function isDenied(op: ParsedOperation, deny: Array<string | RegExp> = []): boolean {
  if (deny.length === 0) return false;
  const candidates = [op.name, op.path, op.operationId ?? ''].filter(Boolean);
  return candidates.some((c) => matchesAny(c, deny));
}

/**
 * Returns true when the operation should be considered for inclusion
 * (before classification deny).
 */
export function matchesInclude(
  op: ParsedOperation,
  include: SkillgateIncludeOptions = {}
): boolean {
  const mode = include.mode ?? 'opt-in';
  const deny = include.deny ?? [];

  if (isDenied(op, deny)) return false;

  if (include.methods && include.methods.length > 0) {
    if (!include.methods.includes(op.method)) return false;
  }

  // Explicit disable via extension
  const x = resolveXHazel(op.xHazelSkill);
  if (op.xHazelSkill === false || x?.enabled === false) return false;

  if (mode === 'all') {
    return true;
  }

  // opt-in
  const hasCustomCriteria =
    (include.tags && include.tags.length > 0) ||
    (include.operationIds && include.operationIds.length > 0) ||
    (include.paths && include.paths.length > 0);

  const tags = include.tags ?? (hasCustomCriteria ? [] : DEFAULT_OPT_IN_TAGS);
  const operationIds = include.operationIds ?? [];
  const paths = include.paths ?? [];

  if (isXHazelEnabled(op.xHazelSkill)) return true;

  if (tags.length > 0 && op.tags.some((t) => tags.includes(t))) return true;

  if (operationIds.length > 0 && op.operationId && operationIds.includes(op.operationId)) {
    return true;
  }

  if (paths.length > 0 && matchesAny(op.path, paths)) return true;

  return false;
}

export { DEFAULT_OPT_IN_TAGS };
