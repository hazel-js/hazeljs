/**
 * @hazeljs/contracts - Standard enums for data classification and decision status
 */

/** Data classification levels for privacy and access control */
export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  PII = 'PII',
}

/** Risk level for scoring and decision thresholds */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/** Decision status for approvals, rejections, and reviews */
export enum DecisionStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVIEW = 'REVIEW',
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}
