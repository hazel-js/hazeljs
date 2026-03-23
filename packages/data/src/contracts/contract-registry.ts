/**
 * Contract Registry - Manage data contracts and their versions
 */

import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type {
  DataContract,
  ContractViolation,
  SchemaChange,
  ContractDiff,
  ContractValidationResult,
} from './contract.types';

@Service()
export class ContractRegistry {
  private contracts: Map<string, Map<string, DataContract>> = new Map();
  private violations: ContractViolation[] = [];

  /**
   * Register a data contract
   */
  register(contract: DataContract): void {
    const versions = this.contracts.get(contract.name) ?? new Map();
    versions.set(contract.version, contract);
    this.contracts.set(contract.name, versions);
    logger.debug(`Registered contract: ${contract.name}@${contract.version}`);
  }

  /**
   * Get a specific contract version
   */
  get(name: string, version?: string): DataContract | undefined {
    const versions = this.contracts.get(name);
    if (!versions) return undefined;

    if (version) {
      return versions.get(version);
    }

    // Return latest version
    const sorted = Array.from(versions.entries()).sort((a, b) => this.compareVersions(b[0], a[0]));
    return sorted[0]?.[1];
  }

  /**
   * List all versions of a contract
   */
  listVersions(name: string): string[] {
    const versions = this.contracts.get(name);
    if (!versions) return [];
    return Array.from(versions.keys()).sort((a, b) => this.compareVersions(b, a));
  }

  /**
   * List all contracts
   */
  listContracts(): Array<{ name: string; versions: string[]; owner: string }> {
    const result: Array<{ name: string; versions: string[]; owner: string }> = [];

    for (const [name, versions] of this.contracts) {
      const latest = this.get(name);
      result.push({
        name,
        versions: Array.from(versions.keys()),
        owner: latest?.owner ?? 'unknown',
      });
    }

    return result;
  }

  /**
   * Deprecate a contract version
   */
  deprecate(name: string, version: string): void {
    const contract = this.get(name, version);
    if (!contract) {
      throw new Error(`Contract not found: ${name}@${version}`);
    }

    contract.status = 'deprecated';
    contract.updatedAt = new Date();
    logger.debug(`Deprecated contract: ${name}@${version}`);
  }

  /**
   * Compare two contract versions to detect breaking changes
   */
  diff(name: string, oldVersion: string, newVersion: string): ContractDiff {
    const oldContract = this.get(name, oldVersion);
    const newContract = this.get(name, newVersion);

    if (!oldContract || !newContract) {
      throw new Error(`Cannot compare: contract versions not found`);
    }

    const changes = this.detectSchemaChanges(oldContract.schema, newContract.schema);
    const breakingChanges = changes.filter((c) => c.breaking);

    return {
      contractName: name,
      oldVersion,
      newVersion,
      changes,
      breakingChanges,
      isBreaking: breakingChanges.length > 0,
    };
  }

  /**
   * Validate data against a contract
   */
  validate(name: string, data: unknown, version?: string): ContractValidationResult {
    const contract = this.get(name, version);
    if (!contract) {
      return {
        valid: false,
        violations: [
          {
            contractName: name,
            contractVersion: version ?? 'latest',
            violationType: 'schema',
            severity: 'error',
            message: `Contract not found: ${name}@${version ?? 'latest'}`,
            details: {},
            timestamp: new Date(),
          },
        ],
        warnings: [],
      };
    }

    const violations: ContractViolation[] = [];
    const warnings: string[] = [];

    // Schema validation
    const schemaViolations = this.validateSchema(contract, data);
    violations.push(...schemaViolations);

    // SLA validation
    if (contract.sla?.completeness) {
      const completenessViolations = this.validateCompleteness(contract, data);
      violations.push(...completenessViolations);
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Record a contract violation
   */
  recordViolation(violation: ContractViolation): void {
    this.violations.push(violation);
    logger.warn(`Contract violation: ${violation.contractName}@${violation.contractVersion}`, {
      type: violation.violationType,
      severity: violation.severity,
      message: violation.message,
    });
  }

  /**
   * Get violations for a contract
   */
  getViolations(name: string, version?: string): ContractViolation[] {
    return this.violations.filter(
      (v) => v.contractName === name && (!version || v.contractVersion === version)
    );
  }

  /**
   * Clear violations older than specified days
   */
  clearOldViolations(days: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    this.violations = this.violations.filter((v) => v.timestamp > cutoff);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private detectSchemaChanges(
    oldSchema: Record<string, unknown>,
    newSchema: Record<string, unknown>
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const allFields = new Set([...Object.keys(oldSchema), ...Object.keys(newSchema)]);

    for (const field of allFields) {
      const oldValue = oldSchema[field];
      const newValue = newSchema[field];

      if (oldValue === undefined && newValue !== undefined) {
        // Field added
        changes.push({
          field,
          changeType: 'added',
          newValue,
          breaking: false,
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        // Field removed - BREAKING
        changes.push({
          field,
          changeType: 'removed',
          oldValue,
          breaking: true,
        });
      } else if (typeof oldValue !== typeof newValue) {
        // Type changed - BREAKING
        changes.push({
          field,
          changeType: 'type_changed',
          oldValue,
          newValue,
          breaking: true,
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Field modified
        changes.push({
          field,
          changeType: 'modified',
          oldValue,
          newValue,
          breaking: false,
        });
      }
    }

    return changes;
  }

  private validateSchema(contract: DataContract, data: unknown): ContractViolation[] {
    const violations: ContractViolation[] = [];

    if (typeof data !== 'object' || data === null) {
      violations.push({
        contractName: contract.name,
        contractVersion: contract.version,
        violationType: 'schema',
        severity: 'error',
        message: 'Data must be an object',
        details: { data },
        timestamp: new Date(),
      });
      return violations;
    }

    const record = data as Record<string, unknown>;

    // Check required fields from schema
    for (const [field, fieldSchema] of Object.entries(contract.schema)) {
      if (typeof fieldSchema === 'object' && fieldSchema !== null) {
        const schema = fieldSchema as Record<string, unknown>;
        if (schema.required === true && record[field] === undefined) {
          violations.push({
            contractName: contract.name,
            contractVersion: contract.version,
            violationType: 'schema',
            severity: 'error',
            message: `Required field missing: ${field}`,
            details: { field, schema },
            timestamp: new Date(),
          });
        }
      }
    }

    return violations;
  }

  private validateCompleteness(contract: DataContract, data: unknown): ContractViolation[] {
    const violations: ContractViolation[] = [];
    const sla = contract.sla?.completeness;
    if (!sla) return violations;

    const record = data as Record<string, unknown>;
    const missingFields = sla.requiredFields.filter(
      (f) => record[f] === undefined || record[f] === null
    );

    if (missingFields.length > 0) {
      const completeness = 1 - missingFields.length / sla.requiredFields.length;
      if (completeness < sla.minCompleteness) {
        violations.push({
          contractName: contract.name,
          contractVersion: contract.version,
          violationType: 'sla',
          severity: 'warning',
          message: `Completeness ${(completeness * 100).toFixed(1)}% below SLA ${(sla.minCompleteness * 100).toFixed(1)}%`,
          details: { missingFields, completeness, minCompleteness: sla.minCompleteness },
          timestamp: new Date(),
        });
      }
    }

    return violations;
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] ?? 0;
      const bPart = bParts[i] ?? 0;
      if (aPart !== bPart) return aPart - bPart;
    }

    return 0;
  }
}
