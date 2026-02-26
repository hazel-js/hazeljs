import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';

export interface QualityCheckResult {
  name: string;
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface DataQualityReport {
  timestamp: Date;
  dataset: string;
  totalRows: number;
  checks: QualityCheckResult[];
  passed: boolean;
}

/**
 * Quality Service - Data quality checks
 * Validates data completeness, consistency, and integrity
 */
@Injectable()
export class QualityService {
  private checks: Map<string, (data: unknown) => Promise<QualityCheckResult> | QualityCheckResult> =
    new Map();

  registerCheck(
    name: string,
    check: (data: unknown) => Promise<QualityCheckResult> | QualityCheckResult
  ): void {
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
          message: error instanceof Error ? error.message : 'Check failed',
        });
      }
    }

    const passed = results.every((r) => r.passed);

    return {
      timestamp: new Date(),
      dataset,
      totalRows,
      checks: results,
      passed,
    };
  }

  completeness(requiredFields: string[]) {
    return (data: unknown): QualityCheckResult => {
      if (data === null || typeof data !== 'object') {
        return { name: 'completeness', passed: false, message: 'Data is not an object' };
      }
      const obj = data as Record<string, unknown>;
      const missing = requiredFields.filter((f) => obj[f] === undefined || obj[f] === null);
      return {
        name: 'completeness',
        passed: missing.length === 0,
        message: missing.length > 0 ? `Missing fields: ${missing.join(', ')}` : undefined,
        details: { missing, required: requiredFields },
      };
    };
  }

  notNull(fields: string[]) {
    return (data: unknown): QualityCheckResult => {
      if (data === null || typeof data !== 'object') {
        return { name: 'notNull', passed: false, message: 'Data is not an object' };
      }
      const obj = data as Record<string, unknown>;
      const nullFields = fields.filter((f) => obj[f] === null || obj[f] === undefined);
      return {
        name: 'notNull',
        passed: nullFields.length === 0,
        message: nullFields.length > 0 ? `Null fields: ${nullFields.join(', ')}` : undefined,
        details: { nullFields },
      };
    };
  }
}
