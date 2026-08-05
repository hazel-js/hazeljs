/**
 * Classify HTTP operations into read / write / destructive / admin.
 */

import type {
  GovernedSkill,
  HttpMethod,
  ParsedOperation,
  SkillClass,
  SkillgateClassifyOptions,
  XHazelSkill,
} from './types';

const DEFAULT_READ: HttpMethod[] = ['GET', 'HEAD'];
const DEFAULT_WRITE: HttpMethod[] = ['POST', 'PUT', 'PATCH'];
const DEFAULT_DESTRUCTIVE: HttpMethod[] = ['DELETE'];
const DEFAULT_ADMIN_PATHS: Array<string | RegExp> = [
  /^\/admin(\/|$)/i,
  /^\/internal(\/|$)/i,
  /^\/debug(\/|$)/i,
  /\/health(\/|$)/i,
];

function matchesAny(value: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? value === p || value.includes(p) : p.test(value)
  );
}

function resolveXHazel(raw?: XHazelSkill | boolean): XHazelSkill | undefined {
  if (raw === undefined || raw === false) return undefined;
  if (raw === true) return { enabled: true };
  return raw;
}

export function classifyOperation(
  op: ParsedOperation,
  options: SkillgateClassifyOptions = {}
): Pick<GovernedSkill, 'class' | 'readOnly' | 'requiresApproval' | 'denied' | 'denyReason'> {
  const readMethods = options.readMethods ?? DEFAULT_READ;
  const writeMethods = options.writeMethods ?? DEFAULT_WRITE;
  const destructiveMethods = options.destructiveMethods ?? DEFAULT_DESTRUCTIVE;
  const adminPaths = options.adminPaths ?? DEFAULT_ADMIN_PATHS;
  const writeRequiresApproval = options.writeRequiresApproval ?? true;
  const allowDestructive = options.allowDestructive ?? false;
  const allowAdmin = options.allowAdmin ?? false;

  const x = resolveXHazel(op.xHazelSkill);

  if (matchesAny(op.path, adminPaths)) {
    if (!allowAdmin && x?.class !== 'read' && x?.class !== 'write') {
      return {
        class: 'admin',
        readOnly: true,
        requiresApproval: true,
        denied: true,
        denyReason: `admin path denied: ${op.path}`,
      };
    }
  }

  let skillClass: SkillClass;
  if (x?.class) {
    skillClass = x.class;
  } else if (destructiveMethods.includes(op.method)) {
    skillClass = 'destructive';
  } else if (writeMethods.includes(op.method)) {
    skillClass = 'write';
  } else if (readMethods.includes(op.method)) {
    skillClass = 'read';
  } else {
    skillClass = 'write';
  }

  if (skillClass === 'destructive' && !allowDestructive) {
    return {
      class: 'destructive',
      readOnly: false,
      requiresApproval: true,
      denied: true,
      denyReason: `destructive method ${op.method} denied (set classify.allowDestructive to allow)`,
    };
  }

  if (skillClass === 'admin' && !allowAdmin) {
    return {
      class: 'admin',
      readOnly: true,
      requiresApproval: true,
      denied: true,
      denyReason: 'admin class denied',
    };
  }

  const readOnly = x?.readOnly ?? skillClass === 'read';
  const requiresApproval =
    x?.requiresApproval ??
    (skillClass === 'read' ? false : writeRequiresApproval || skillClass === 'destructive');

  return { class: skillClass, readOnly, requiresApproval };
}

export { DEFAULT_READ, DEFAULT_WRITE, DEFAULT_DESTRUCTIVE, DEFAULT_ADMIN_PATHS };
