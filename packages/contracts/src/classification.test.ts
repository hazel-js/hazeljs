import { DataClassification, RiskLevel, DecisionStatus } from './classification';

describe('DataClassification', () => {
  it('should have expected enum values', () => {
    expect(DataClassification.PUBLIC).toBe('PUBLIC');
    expect(DataClassification.INTERNAL).toBe('INTERNAL');
    expect(DataClassification.CONFIDENTIAL).toBe('CONFIDENTIAL');
    expect(DataClassification.PII).toBe('PII');
  });

  it('should have exactly 4 values', () => {
    expect(Object.keys(DataClassification)).toHaveLength(4);
  });
});

describe('RiskLevel', () => {
  it('should have expected enum values', () => {
    expect(RiskLevel.LOW).toBe('LOW');
    expect(RiskLevel.MEDIUM).toBe('MEDIUM');
    expect(RiskLevel.HIGH).toBe('HIGH');
  });

  it('should have exactly 3 values', () => {
    expect(Object.keys(RiskLevel)).toHaveLength(3);
  });
});

describe('DecisionStatus', () => {
  it('should have expected enum values', () => {
    expect(DecisionStatus.APPROVED).toBe('APPROVED');
    expect(DecisionStatus.REJECTED).toBe('REJECTED');
    expect(DecisionStatus.REVIEW).toBe('REVIEW');
    expect(DecisionStatus.ALLOW).toBe('ALLOW');
    expect(DecisionStatus.DENY).toBe('DENY');
  });

  it('should have exactly 5 values', () => {
    expect(Object.keys(DecisionStatus)).toHaveLength(5);
  });
});
