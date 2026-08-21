import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';

export interface QualityCheckResult {
  name: string;
  passed: boolean;
  score?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface DataQualityReport {
  timestamp: Date;
  dataset: string;
  totalRows: number;
  checks: QualityCheckResult[];
  passed: boolean;
  /** Composite quality score 0–100 (average of individual check scores). */
  score: number;
}

export interface FieldProfile {
  count: number;
  nullCount: number;
  nullPct: number;
  uniqueCount: number;
  cardinality: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  stddev?: number;
  topValues: Array<{ value: unknown; count: number }>;
}

export interface DataProfile {
  dataset: string;
  totalRows: number;
  fields: Record<string, FieldProfile>;
  generatedAt: Date;
}

export interface AnomalyResult {
  field: string;
  rowIndex: number;
  value: unknown;
  zScore: number;
  message: string;
  method?: 'zscore' | 'iqr' | 'mad';
}

export type CheckFn = (data: unknown) => QualityCheckResult | Promise<QualityCheckResult>;
type SyncCheckFn = (data: unknown) => QualityCheckResult;

/**
 * Quality Service — data quality checks, profiling, and anomaly detection.
 *
 * Built-in check factories:
 * - completeness(fields[])
 * - notNull(fields[])
 * - uniqueness(fields[])
 * - range(field, { min, max })
 * - pattern(field, regex, message?)
 * - referentialIntegrity(field, allowedValues[])
 * - freshness(field, maxAgeMs)
 * - rowCount({ min?, max? })
 * - schemaDrift(expectedFields | BaseSchema)
 *
 * Profiling:
 * - profile(dataset, records[]) → DataProfile
 *
 * Anomaly detection:
 * - detectAnomalies(records[], fields[], threshold?) → AnomalyResult[]  (Z-score)
 * - detectAnomaliesIQR(records[], fields[], k?) → AnomalyResult[]
 * - detectAnomaliesMAD(records[], fields[], threshold?) → AnomalyResult[]
 */
@Service()
export class QualityService {
  private checks: Map<string, CheckFn> = new Map();

  registerCheck(name: string, check: CheckFn): void {
    this.checks.set(name, check);
    logger.debug(`Registered quality check: ${name}`);
  }

  async runChecks(dataset: string, data: unknown): Promise<DataQualityReport> {
    const results: QualityCheckResult[] = [];
    const items = Array.isArray(data) ? data : [data];
    const totalRows = items.length;

    for (const [name, check] of this.checks) {
      try {
        const result = await Promise.resolve(check(data));
        results.push({ ...result, name: result.name || name });
      } catch (error) {
        results.push({
          name,
          passed: false,
          score: 0,
          message: error instanceof Error ? error.message : 'Check failed',
        });
      }
    }

    const passed = results.every((r) => r.passed);
    const scores = results.map((r) => (r.score !== undefined ? r.score : r.passed ? 100 : 0));
    const score =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

    return { timestamp: new Date(), dataset, totalRows, checks: results, passed, score };
  }

  // ─── Built-in check factories ─────────────────────────────────────────────

  completeness(requiredFields: string[]): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      let totalMissing = 0;
      const missingByField: Record<string, number> = {};

      for (const item of items) {
        if (item === null || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        for (const f of requiredFields) {
          if (obj[f] === undefined || obj[f] === null) {
            totalMissing++;
            missingByField[f] = (missingByField[f] ?? 0) + 1;
          }
        }
      }

      const total = items.length * requiredFields.length;
      const score = total > 0 ? Math.round(((total - totalMissing) / total) * 100) : 100;
      return {
        name: 'completeness',
        passed: totalMissing === 0,
        score,
        message:
          totalMissing > 0
            ? `${totalMissing} missing values across ${Object.keys(missingByField).length} fields`
            : undefined,
        details: { missingByField, required: requiredFields },
      };
    };
  }

  notNull(fields: string[]): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const nullFields: string[] = [];

      for (const item of items) {
        if (item === null || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        for (const f of fields) {
          if ((obj[f] === null || obj[f] === undefined) && !nullFields.includes(f)) {
            nullFields.push(f);
          }
        }
      }

      return {
        name: 'notNull',
        passed: nullFields.length === 0,
        score:
          nullFields.length === 0
            ? 100
            : Math.round(((fields.length - nullFields.length) / fields.length) * 100),
        message: nullFields.length > 0 ? `Null fields: ${nullFields.join(', ')}` : undefined,
        details: { nullFields },
      };
    };
  }

  uniqueness(fields: string[]): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const seen: Record<string, Set<unknown>> = {};
      const duplicates: Record<string, number> = {};

      for (const f of fields) seen[f] = new Set();

      for (const item of items) {
        if (item === null || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        for (const f of fields) {
          const v = obj[f];
          if (seen[f].has(v)) {
            duplicates[f] = (duplicates[f] ?? 0) + 1;
          } else {
            seen[f].add(v);
          }
        }
      }

      const totalDups = Object.values(duplicates).reduce((a, b) => a + b, 0);
      const score =
        items.length > 0 ? Math.round(((items.length - totalDups) / items.length) * 100) : 100;

      return {
        name: 'uniqueness',
        passed: totalDups === 0,
        score,
        message: totalDups > 0 ? `${totalDups} duplicate values found` : undefined,
        details: { duplicates, fields },
      };
    };
  }

  range(field: string, options: { min?: number; max?: number }): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const violations: Array<{ index: number; value: unknown }> = [];

      items.forEach((item, idx) => {
        if (item === null || typeof item !== 'object') return;
        const obj = item as Record<string, unknown>;
        const v = obj[field];
        if (typeof v !== 'number') return;
        if (options.min !== undefined && v < options.min) violations.push({ index: idx, value: v });
        else if (options.max !== undefined && v > options.max)
          violations.push({ index: idx, value: v });
      });

      const score =
        items.length > 0
          ? Math.round(((items.length - violations.length) / items.length) * 100)
          : 100;

      return {
        name: `range:${field}`,
        passed: violations.length === 0,
        score,
        message:
          violations.length > 0
            ? `${violations.length} values out of range [${options.min ?? '−∞'}, ${options.max ?? '+∞'}]`
            : undefined,
        details: { field, violations: violations.slice(0, 10), options },
      };
    };
  }

  pattern(field: string, regex: RegExp, message?: string): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const violations: Array<{ index: number; value: unknown }> = [];

      items.forEach((item, idx) => {
        if (item === null || typeof item !== 'object') return;
        const obj = item as Record<string, unknown>;
        const v = obj[field];
        if (typeof v === 'string' && !regex.test(v)) violations.push({ index: idx, value: v });
      });

      const score =
        items.length > 0
          ? Math.round(((items.length - violations.length) / items.length) * 100)
          : 100;

      return {
        name: `pattern:${field}`,
        passed: violations.length === 0,
        score,
        message:
          violations.length > 0
            ? (message ?? `${violations.length} values don't match pattern ${regex.source}`)
            : undefined,
        details: { field, regex: regex.source, violations: violations.slice(0, 10) },
      };
    };
  }

  referentialIntegrity(field: string, allowedValues: unknown[]): SyncCheckFn {
    const allowed = new Set(allowedValues);
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const violations: Array<{ index: number; value: unknown }> = [];

      items.forEach((item, idx) => {
        if (item === null || typeof item !== 'object') return;
        const obj = item as Record<string, unknown>;
        const v = obj[field];
        if (v !== undefined && v !== null && !allowed.has(v)) {
          violations.push({ index: idx, value: v });
        }
      });

      const score =
        items.length > 0
          ? Math.round(((items.length - violations.length) / items.length) * 100)
          : 100;

      return {
        name: `referentialIntegrity:${field}`,
        passed: violations.length === 0,
        score,
        message:
          violations.length > 0 ? `${violations.length} values not in allowed set` : undefined,
        details: { field, violations: violations.slice(0, 10), allowedCount: allowedValues.length },
      };
    };
  }

  /**
   * Check that a timestamp field is not older than maxAgeMs.
   */
  freshness(field: string, maxAgeMs: number, options: { now?: Date } = {}): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const now = options.now ?? new Date();
      const stale: Array<{ index: number; ageMs: number }> = [];

      items.forEach((item, idx) => {
        if (item === null || typeof item !== 'object') return;
        const raw = (item as Record<string, unknown>)[field];
        if (raw === undefined || raw === null) {
          stale.push({ index: idx, ageMs: Infinity });
          return;
        }
        const ts =
          raw instanceof Date
            ? raw
            : typeof raw === 'number'
              ? new Date(raw)
              : new Date(String(raw));
        if (Number.isNaN(ts.getTime())) {
          stale.push({ index: idx, ageMs: Infinity });
          return;
        }
        const ageMs = now.getTime() - ts.getTime();
        if (ageMs > maxAgeMs) stale.push({ index: idx, ageMs });
      });

      const score =
        items.length > 0 ? Math.round(((items.length - stale.length) / items.length) * 100) : 100;

      return {
        name: `freshness:${field}`,
        passed: stale.length === 0,
        score,
        message:
          stale.length > 0
            ? `${stale.length} rows older than ${maxAgeMs}ms on field "${field}"`
            : undefined,
        details: { field, maxAgeMs, stale: stale.slice(0, 10) },
      };
    };
  }

  /**
   * Assert row count is within [min, max] bounds.
   */
  rowCount(bounds: { min?: number; max?: number }): SyncCheckFn {
    return (data: unknown): QualityCheckResult => {
      const count = Array.isArray(data) ? data.length : data == null ? 0 : 1;
      const below = bounds.min !== undefined && count < bounds.min;
      const above = bounds.max !== undefined && count > bounds.max;
      const passed = !below && !above;
      return {
        name: 'rowCount',
        passed,
        score: passed ? 100 : 0,
        message: passed
          ? undefined
          : `Row count ${count} outside bounds [${bounds.min ?? '−∞'}, ${bounds.max ?? '+∞'}]`,
        details: { count, ...bounds },
      };
    };
  }

  /**
   * Detect schema drift: missing/extra fields vs expected field list or BaseSchema shape.
   */
  schemaDrift(
    expected:
      | string[]
      | { shape?: Record<string, unknown>; toJsonSchema?: () => Record<string, unknown> }
  ): SyncCheckFn {
    const expectedFields = Array.isArray(expected)
      ? expected
      : expected.shape
        ? Object.keys(expected.shape)
        : expected.toJsonSchema
          ? Object.keys(
              ((expected.toJsonSchema() as { properties?: Record<string, unknown> }).properties ??
                {}) as Record<string, unknown>
            )
          : [];

    return (data: unknown): QualityCheckResult => {
      const items = Array.isArray(data) ? data : [data];
      const actual = new Set<string>();
      for (const item of items) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          for (const k of Object.keys(item as object)) actual.add(k);
        }
      }
      const expectedSet = new Set(expectedFields);
      const missing = expectedFields.filter((f) => !actual.has(f));
      const extra = [...actual].filter((f) => !expectedSet.has(f));
      const passed = missing.length === 0 && extra.length === 0;
      const total = expectedFields.length || 1;
      const score = Math.round(((total - missing.length) / total) * 100);

      return {
        name: 'schemaDrift',
        passed,
        score: extra.length > 0 ? Math.min(score, 90) : score,
        message: passed
          ? undefined
          : `Schema drift: missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`,
        details: { missing, extra, expected: expectedFields, actual: [...actual] },
      };
    };
  }

  // ─── Data Profiling ───────────────────────────────────────────────────────

  profile(dataset: string, records: Record<string, unknown>[]): DataProfile {
    if (records.length === 0) {
      return { dataset, totalRows: 0, fields: {}, generatedAt: new Date() };
    }

    const fieldNames = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
    const fields: Record<string, FieldProfile> = {};

    for (const field of fieldNames) {
      const values = records.map((r) => r[field]);
      const nonNull = values.filter((v) => v !== null && v !== undefined);
      const nums = nonNull.filter((v) => typeof v === 'number') as number[];
      const uniqueSet = new Set(values.map((v) => JSON.stringify(v)));

      // Top values by frequency
      const freq = new Map<string, { value: unknown; count: number }>();
      for (const v of values) {
        const k = JSON.stringify(v);
        const entry = freq.get(k) ?? { value: v, count: 0 };
        entry.count++;
        freq.set(k, entry);
      }
      const topValues = Array.from(freq.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      let mean: number | undefined;
      let stddev: number | undefined;
      let min: number | string | undefined;
      let max: number | string | undefined;

      if (nums.length > 0) {
        mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        stddev = Math.sqrt(nums.reduce((acc, v) => acc + Math.pow(v - mean!, 2), 0) / nums.length);
        min = Math.min(...nums);
        max = Math.max(...nums);
      } else {
        const strs = nonNull.filter((v) => typeof v === 'string') as string[];
        if (strs.length > 0) {
          const sorted = [...strs].sort();
          min = sorted[0];
          max = sorted[sorted.length - 1];
        }
      }

      fields[field] = {
        count: values.length,
        nullCount: values.length - nonNull.length,
        nullPct: parseFloat(((1 - nonNull.length / values.length) * 100).toFixed(2)),
        uniqueCount: uniqueSet.size,
        cardinality: parseFloat((uniqueSet.size / values.length).toFixed(4)),
        min,
        max,
        mean: mean !== undefined ? parseFloat(mean.toFixed(4)) : undefined,
        stddev: stddev !== undefined ? parseFloat(stddev.toFixed(4)) : undefined,
        topValues,
      };
    }

    return { dataset, totalRows: records.length, fields, generatedAt: new Date() };
  }

  // ─── Anomaly Detection ────────────────────────────────────────────────────

  /**
   * Detect statistical anomalies using Z-score.
   * @param records Dataset rows
   * @param fields  Numeric fields to analyze
   * @param threshold Z-score threshold (default: 3.0)
   */
  detectAnomalies(
    records: Record<string, unknown>[],
    fields: string[],
    threshold = 3.0
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    for (const field of fields) {
      const nums = records
        .map((r, i) => ({ value: r[field], index: i }))
        .filter((x) => typeof x.value === 'number') as Array<{ value: number; index: number }>;

      if (nums.length < 3) continue;

      const mean = nums.reduce((a, b) => a + b.value, 0) / nums.length;
      const stddev = Math.sqrt(
        nums.reduce((acc, b) => acc + Math.pow(b.value - mean, 2), 0) / nums.length
      );

      if (stddev === 0) continue;

      for (const { value, index } of nums) {
        const zScore = Math.abs((value - mean) / stddev);
        if (zScore > threshold) {
          anomalies.push({
            field,
            rowIndex: index,
            value,
            zScore: parseFloat(zScore.toFixed(3)),
            method: 'zscore',
            message: `Field "${field}" value ${value} is ${zScore.toFixed(2)} stddevs from mean (${mean.toFixed(2)})`,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }

  /**
   * Detect anomalies using the IQR rule (Tukey fences).
   * @param k multiplier (default 1.5)
   */
  detectAnomaliesIQR(
    records: Record<string, unknown>[],
    fields: string[],
    k = 1.5
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    for (const field of fields) {
      const nums = records
        .map((r, i) => ({ value: r[field], index: i }))
        .filter((x) => typeof x.value === 'number') as Array<{ value: number; index: number }>;
      if (nums.length < 4) continue;

      const sorted = [...nums].sort((a, b) => a.value - b.value);
      const q1 = percentileSorted(
        sorted.map((x) => x.value),
        25
      );
      const q3 = percentileSorted(
        sorted.map((x) => x.value),
        75
      );
      const iqr = q3 - q1;
      const low = q1 - k * iqr;
      const high = q3 + k * iqr;

      for (const { value, index } of nums) {
        if (value < low || value > high) {
          const score = iqr === 0 ? Infinity : Math.abs(value - (q1 + q3) / 2) / iqr;
          anomalies.push({
            field,
            rowIndex: index,
            value,
            zScore: parseFloat(score.toFixed(3)),
            method: 'iqr',
            message: `Field "${field}" value ${value} outside IQR fences [${low.toFixed(2)}, ${high.toFixed(2)}]`,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }

  /**
   * Detect anomalies using Median Absolute Deviation (robust Z-score).
   * @param threshold modified Z-score threshold (default 3.5)
   */
  detectAnomaliesMAD(
    records: Record<string, unknown>[],
    fields: string[],
    threshold = 3.5
  ): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];
    const consistencyConstant = 0.6745;

    for (const field of fields) {
      const nums = records
        .map((r, i) => ({ value: r[field], index: i }))
        .filter((x) => typeof x.value === 'number') as Array<{ value: number; index: number }>;
      if (nums.length < 3) continue;

      const values = nums.map((x) => x.value);
      const med = median(values);
      const absDevs = values.map((v) => Math.abs(v - med));
      const mad = median(absDevs);
      if (mad === 0) continue;

      for (const { value, index } of nums) {
        const modifiedZ = (consistencyConstant * Math.abs(value - med)) / mad;
        if (modifiedZ > threshold) {
          anomalies.push({
            field,
            rowIndex: index,
            value,
            zScore: parseFloat(modifiedZ.toFixed(3)),
            method: 'mad',
            message: `Field "${field}" value ${value} has MAD Z-score ${modifiedZ.toFixed(2)} (median=${med})`,
          });
        }
      }
    }

    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
