import type { KnowledgeFact } from './types';

export function toDate(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function isFactValidAt(fact: KnowledgeFact, asOf?: Date | string): boolean {
  if (asOf === undefined) {
    // current: valid if no validUntil or validUntil in the future
    const until = toDate(fact.validUntil);
    if (until && until.getTime() < Date.now()) return false;
    const from = toDate(fact.validFrom);
    if (from && from.getTime() > Date.now()) return false;
    return true;
  }
  const at = toDate(asOf);
  if (!at) return true;
  const from = toDate(fact.validFrom);
  const until = toDate(fact.validUntil);
  if (from && at.getTime() < from.getTime()) return false;
  if (until && at.getTime() > until.getTime()) return false;
  return true;
}

export function factsOverlap(a: KnowledgeFact, b: KnowledgeFact): boolean {
  const aFrom = toDate(a.validFrom)?.getTime() ?? Number.NEGATIVE_INFINITY;
  const aUntil = toDate(a.validUntil)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bFrom = toDate(b.validFrom)?.getTime() ?? Number.NEGATIVE_INFINITY;
  const bUntil = toDate(b.validUntil)?.getTime() ?? Number.POSITIVE_INFINITY;
  return aFrom <= bUntil && bFrom <= aUntil;
}

export function objectsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function changesBetween(
  facts: KnowledgeFact[],
  from: Date | string,
  to: Date | string
): KnowledgeFact[] {
  const start = toDate(from)?.getTime() ?? 0;
  const end = toDate(to)?.getTime() ?? Date.now();
  return facts.filter((f) => {
    const vf = toDate(f.validFrom)?.getTime();
    const vu = toDate(f.validUntil)?.getTime();
    const created = toDate(f.createdAt)?.getTime();
    if (vf !== undefined && vf >= start && vf <= end) return true;
    if (vu !== undefined && vu >= start && vu <= end) return true;
    if (created !== undefined && created >= start && created <= end) return true;
    return false;
  });
}
