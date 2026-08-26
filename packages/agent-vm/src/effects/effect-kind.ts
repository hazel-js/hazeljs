/**
 * Effect kind lattice — from most to least permissive for speculation.
 */
export enum EffectKind {
  PURE = 'pure',
  READ = 'read',
  REVERSIBLE = 'reversible',
  IRREVERSIBLE = 'irreversible',
}

/** Metadata stored by effect decorators on tool methods. */
export interface EffectMetadata {
  kind: EffectKind;
  /** Method name of the paired @Compensate handler (for reversible tools). */
  compensate?: string;
  /** Optional predictor for store-buffer mode on irreversible tools. */
  predict?: (input: Record<string, unknown>) => unknown;
}

/** Journal entry passed to @Compensate handlers. */
export interface EffectRecord<TOutput = unknown> {
  entryId: string;
  toolName: string;
  agentId: string;
  branchId?: string;
  runId?: string;
  sessionId?: string;
  input: Record<string, unknown>;
  output: TOutput;
  timestamp: Date;
}

/** Whether an effect kind is safe inside a speculative branch. */
export function isSpeculationSafe(kind: EffectKind): boolean {
  return kind === EffectKind.PURE || kind === EffectKind.READ || kind === EffectKind.REVERSIBLE;
}

/** Default effect when no decorator is present — safe default. */
export const DEFAULT_EFFECT_KIND = EffectKind.IRREVERSIBLE;
