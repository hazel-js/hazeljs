/**
 * Opt-in confidence calibration from DecisionHistory + evaluations.
 *
 * - Fit is explicit (never automatic on decide).
 * - Calibrated values are for reporting / Lab only unless the host applies them.
 * - Never injected into model prompts (avoids feedback loops).
 * - Never authorizes execution — Gatekeeper / policy still govern.
 */

import type { DecisionConfidence } from '../types';
import type { DecisionHistory, DecisionHistoryRecord } from '../history/decision-history';
import { clamp01 } from '../utils';

export interface CalibrationSample {
  /** Reported confidence in [0, 1]. */
  reported: number;
  /** 1 if decision matched expected / was correct, else 0. */
  correct: number;
  name?: string;
}

export interface CalibrationBin {
  /** Bin center (reported confidence). */
  reported: number;
  /** Empirical accuracy in bin. */
  empirical: number;
  count: number;
  lo: number;
  hi: number;
}

export interface CalibrationModel {
  /** Number of samples used. */
  n: number;
  bins: CalibrationBin[];
  /** Expected Calibration Error (weighted). */
  ece: number;
  /** Brier score. */
  brier: number;
  fittedAt: string;
  name?: string;
  /** Safety: calibration never authorizes. */
  authorizesExecution: false;
  /** Safety: never auto-fed to prompts. */
  promptInjectionForbidden: true;
}

export interface FitCalibrationOptions {
  bins?: number;
  name?: string;
  /** Minimum samples per bin to keep (default 1). */
  minBinCount?: number;
}

function isCorrect(rec: DecisionHistoryRecord): boolean | undefined {
  const ev = rec.evaluation;
  if (!ev) return undefined;
  if (ev.expectedDecision !== undefined) {
    return String(rec.decision) === String(ev.expectedDecision);
  }
  if (typeof ev.actualOutcome === 'boolean') return ev.actualOutcome;
  if (
    ev.actualOutcome &&
    typeof ev.actualOutcome === 'object' &&
    'correct' in (ev.actualOutcome as object)
  ) {
    return Boolean((ev.actualOutcome as { correct: unknown }).correct);
  }
  return undefined;
}

/** Collect labeled samples from history (records with evaluations only). */
export function samplesFromHistory(
  history: DecisionHistory,
  options?: { name?: string }
): CalibrationSample[] {
  const rows = history.query({ name: options?.name, limit: history.size() });
  const out: CalibrationSample[] = [];
  for (const r of rows) {
    const ok = isCorrect(r);
    if (ok === undefined) continue;
    if (typeof r.confidence !== 'number' || !Number.isFinite(r.confidence)) continue;
    out.push({
      reported: clamp01(r.confidence),
      correct: ok ? 1 : 0,
      name: r.name,
    });
  }
  return out;
}

/**
 * Fit a simple equal-width reliability diagram (piecewise constant calibration).
 */
export function fitCalibration(
  samples: CalibrationSample[],
  options: FitCalibrationOptions = {}
): CalibrationModel {
  const binCount = Math.max(2, Math.min(20, options.bins ?? 10));
  const minBin = options.minBinCount ?? 1;
  const width = 1 / binCount;
  const buckets: Array<{ sumReported: number; sumCorrect: number; count: number }> = Array.from(
    { length: binCount },
    () => ({ sumReported: 0, sumCorrect: 0, count: 0 })
  );

  let brierSum = 0;
  for (const s of samples) {
    const reported = clamp01(s.reported);
    const correct = s.correct ? 1 : 0;
    brierSum += (reported - correct) ** 2;
    const idx = Math.min(binCount - 1, Math.floor(reported * binCount));
    const b = buckets[idx]!;
    b.sumReported += reported;
    b.sumCorrect += correct;
    b.count += 1;
  }

  const bins: CalibrationBin[] = [];
  let ece = 0;
  const n = samples.length;
  for (let i = 0; i < binCount; i++) {
    const b = buckets[i]!;
    if (b.count < minBin) continue;
    const lo = i * width;
    const hi = (i + 1) * width;
    const empirical = b.sumCorrect / b.count;
    const reported = b.sumReported / b.count;
    bins.push({ reported, empirical, count: b.count, lo, hi });
    if (n > 0) ece += (b.count / n) * Math.abs(reported - empirical);
  }

  return {
    n,
    bins,
    ece: n > 0 ? ece : 0,
    brier: n > 0 ? brierSum / n : 0,
    fittedAt: new Date().toISOString(),
    name: options.name,
    authorizesExecution: false,
    promptInjectionForbidden: true,
  };
}

export function fitCalibrationFromHistory(
  history: DecisionHistory,
  options?: FitCalibrationOptions & { name?: string }
): CalibrationModel {
  return fitCalibration(samplesFromHistory(history, { name: options?.name }), options);
}

/**
 * Map a reported confidence through the reliability diagram (piecewise constant).
 * Returns original value when model has no bins / empty.
 */
export function applyCalibration(reported: number, model: CalibrationModel): number {
  const v = clamp01(reported);
  if (!model.bins.length) return v;
  // Prefer bin containing v by [lo, hi); else nearest by reported center
  const containing =
    model.bins.find((b) => v >= b.lo && v < b.hi) ?? model.bins.find((b) => v === 1 && b.hi === 1);
  if (containing) return clamp01(containing.empirical);
  let best = model.bins[0]!;
  let bestDist = Math.abs(v - best.reported);
  for (const b of model.bins) {
    const d = Math.abs(v - b.reported);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return clamp01(best.empirical);
}

/** Build a calibrated DecisionConfidence from a raw one (reporting only). */
export function calibrateConfidence(
  detail: DecisionConfidence,
  model: CalibrationModel
): DecisionConfidence {
  const value = applyCalibration(detail.value, model);
  return {
    ...detail,
    value,
    type: 'calibrated',
    calibrated: true,
    components: {
      ...detail.components,
      providerConfidence: detail.value,
    },
  };
}

/** Summary DTO for control-plane UI. */
export function calibrationReport(model: CalibrationModel): {
  n: number;
  ece: number;
  brier: number;
  bins: CalibrationBin[];
  fittedAt: string;
  name?: string;
  notes: string[];
} {
  return {
    n: model.n,
    ece: model.ece,
    brier: model.brier,
    bins: model.bins,
    fittedAt: model.fittedAt,
    name: model.name,
    notes: [
      'Calibrated scores are for evaluation / Lab reporting only.',
      'Calibration never authorizes execution.',
      'History is never auto-injected into model prompts.',
    ],
  };
}
