/**
 * @hazeljs/data - Data Contract Types
 */

export type ContractStatus = 'active' | 'deprecated' | 'breaking';

export interface DataContract {
  name: string;
  version: string;
  description?: string;
  owner: string;
  schema: Record<string, unknown>;
  sla?: DataContractSLA;
  consumers?: string[];
  producers?: string[];
  status: ContractStatus;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface DataContractSLA {
  freshness?: {
    maxDelayMinutes: number;
    checkIntervalMinutes?: number;
  };
  completeness?: {
    minCompleteness: number;
    requiredFields: string[];
  };
  quality?: {
    minQualityScore: number;
    checks: string[];
  };
  availability?: {
    minUptime: number;
  };
}

export interface ContractViolation {
  contractName: string;
  contractVersion: string;
  violationType: 'schema' | 'sla' | 'breaking_change';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

export interface SchemaChange {
  field: string;
  changeType: 'added' | 'removed' | 'modified' | 'type_changed';
  oldValue?: unknown;
  newValue?: unknown;
  breaking: boolean;
}

export interface ContractDiff {
  contractName: string;
  oldVersion: string;
  newVersion: string;
  changes: SchemaChange[];
  breakingChanges: SchemaChange[];
  isBreaking: boolean;
}

export interface ContractValidationResult {
  valid: boolean;
  violations: ContractViolation[];
  warnings: string[];
}
