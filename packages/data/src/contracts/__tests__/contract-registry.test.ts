import { ContractRegistry } from '../contract-registry';
import type { DataContract } from '../contract.types';

describe('ContractRegistry', () => {
  let registry: ContractRegistry;

  beforeEach(() => {
    registry = new ContractRegistry();
  });

  describe('register', () => {
    it('should register a contract', () => {
      const contract: DataContract = {
        name: 'users',
        version: '1.0.0',
        owner: 'data-team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);
      const retrieved = registry.get('users', '1.0.0');

      expect(retrieved).toEqual(contract);
    });

    it('should register multiple versions of same contract', () => {
      const v1: DataContract = {
        name: 'products',
        version: '1.0.0',
        owner: 'team-a',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'products',
        version: '2.0.0',
        owner: 'team-a',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      expect(registry.get('products', '1.0.0')).toEqual(v1);
      expect(registry.get('products', '2.0.0')).toEqual(v2);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent contract', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined for non-existent version', () => {
      const v1: DataContract = {
        name: 'test',
        version: '1.0.0',
        owner: 'team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      expect(registry.get('test', '2.0.0')).toBeUndefined();
    });

    it('should return latest version when no version specified', () => {
      const v1: DataContract = {
        name: 'orders',
        version: '1.0.0',
        owner: 'team-b',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'orders',
        version: '2.1.0',
        owner: 'team-b',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      expect(registry.get('orders')).toEqual(v2);
    });

    it('should return specific version when requested', () => {
      const v1: DataContract = {
        name: 'events',
        version: '1.0.0',
        owner: 'team-c',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);

      expect(registry.get('events', '1.0.0')).toEqual(v1);
    });

    it('should handle contract with no versions map', () => {
      expect(registry.get('empty')).toBeUndefined();
      expect(registry.get('empty', '1.0.0')).toBeUndefined();
    });
  });

  describe('listVersions', () => {
    it('should return empty array for non-existent contract', () => {
      expect(registry.listVersions('nonexistent')).toEqual([]);
    });

    it('should list all versions sorted descending', () => {
      const contracts = [{ version: '1.0.0' }, { version: '2.0.0' }, { version: '1.5.0' }].map(
        (v) => ({
          name: 'analytics',
          version: v.version,
          owner: 'team-d',
          schema: { type: 'object', properties: {} },
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      contracts.forEach((c) => registry.register(c));

      const versions = registry.listVersions('analytics');
      expect(versions).toEqual(['2.0.0', '1.5.0', '1.0.0']);
    });

    it('should handle single version', () => {
      const contract: DataContract = {
        name: 'single-version',
        version: '1.0.0',
        owner: 'team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const versions = registry.listVersions('single-version');
      expect(versions).toEqual(['1.0.0']);
    });
  });

  describe('listContracts', () => {
    it('should return empty array when no contracts registered', () => {
      expect(registry.listContracts()).toEqual([]);
    });

    it('should list all contracts with their versions', () => {
      const users: DataContract = {
        name: 'users',
        version: '1.0.0',
        owner: 'auth-team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const products: DataContract = {
        name: 'products',
        version: '2.0.0',
        owner: 'catalog-team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(users);
      registry.register(products);

      const contracts = registry.listContracts();
      expect(contracts).toHaveLength(2);
      expect(contracts.find((c) => c.name === 'users')).toEqual({
        name: 'users',
        versions: ['1.0.0'],
        owner: 'auth-team',
      });
      expect(contracts.find((c) => c.name === 'products')).toEqual({
        name: 'products',
        versions: ['2.0.0'],
        owner: 'catalog-team',
      });
    });
  });

  describe('validate', () => {
    it('should validate data against contract schema', () => {
      const contract: DataContract = {
        name: 'user-schema',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['id', 'email'],
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const validData = { id: '123', email: 'test@example.com' };
      const result = registry.validate('user-schema', validData, '1.0.0');

      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should validate data structure', () => {
      const contract: DataContract = {
        name: 'strict-schema',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const data = { name: 'test' };
      const result = registry.validate('strict-schema', data, '1.0.0');

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should return error for non-existent contract', () => {
      const result = registry.validate('nonexistent', {}, '1.0.0');

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].message).toContain('Contract not found');
    });

    it('should validate SLA completeness requirements', () => {
      const contract: DataContract = {
        name: 'sla-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        sla: {
          completeness: {
            minCompleteness: 0.9,
            requiredFields: ['id', 'name', 'email'],
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const completeData = { id: '1', name: 'Test', email: 'test@example.com' };
      const result = registry.validate('sla-test', completeData, '1.0.0');

      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should validate without SLA when not configured', () => {
      const contract: DataContract = {
        name: 'no-sla',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const data = { id: '1' };
      const result = registry.validate('no-sla', data, '1.0.0');

      expect(result.valid).toBe(true);
    });

    it('should reject non-object data', () => {
      const contract: DataContract = {
        name: 'object-only',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const result = registry.validate('object-only', 'not an object', '1.0.0');

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].message).toContain('must be an object');
    });

    it('should reject null data', () => {
      const contract: DataContract = {
        name: 'null-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {},
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const result = registry.validate('null-test', null, '1.0.0');

      expect(result.valid).toBe(false);
      expect(result.violations[0].message).toContain('must be an object');
    });

    it('should validate required fields in schema', () => {
      const contract: DataContract = {
        name: 'required-fields-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          optional: { type: 'string' },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const invalidData = { id: '123' }; // missing required 'name'
      const result = registry.validate('required-fields-test', invalidData, '1.0.0');

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.message.includes('Required field missing'))).toBe(
        true
      );
    });

    it('should pass validation when all required fields present', () => {
      const contract: DataContract = {
        name: 'complete-data-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const validData = { id: '123', name: 'Test' };
      const result = registry.validate('complete-data-test', validData, '1.0.0');

      expect(result.valid).toBe(true);
    });

    it('should validate completeness SLA with missing fields', () => {
      const contract: DataContract = {
        name: 'completeness-sla-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        sla: {
          completeness: {
            minCompleteness: 0.8,
            requiredFields: ['id', 'name', 'email'],
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const incompleteData = { id: '123' }; // missing name and email
      const result = registry.validate('completeness-sla-test', incompleteData, '1.0.0');

      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should handle null values in completeness check', () => {
      const contract: DataContract = {
        name: 'null-completeness-test',
        version: '1.0.0',
        owner: 'platform',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        sla: {
          completeness: {
            minCompleteness: 0.9,
            requiredFields: ['id', 'name'],
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);

      const dataWithNull = { id: '123', name: null };
      const result = registry.validate('null-completeness-test', dataWithNull, '1.0.0');

      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('deprecate', () => {
    it('should deprecate a contract version', () => {
      const contract: DataContract = {
        name: 'old-contract',
        version: '1.0.0',
        owner: 'team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(contract);
      registry.deprecate('old-contract', '1.0.0');

      const retrieved = registry.get('old-contract', '1.0.0');
      expect(retrieved?.status).toBe('deprecated');
    });

    it('should throw error when deprecating non-existent contract', () => {
      expect(() => {
        registry.deprecate('nonexistent', '1.0.0');
      }).toThrow('Contract not found');
    });

    it('should update updatedAt timestamp when deprecating', () => {
      const contract: DataContract = {
        name: 'test-deprecate',
        version: '1.0.0',
        owner: 'team',
        schema: { type: 'object', properties: {} },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(2020, 0, 1),
      };

      registry.register(contract);
      const beforeDeprecate = registry.get('test-deprecate', '1.0.0')?.updatedAt;

      registry.deprecate('test-deprecate', '1.0.0');

      const afterDeprecate = registry.get('test-deprecate', '1.0.0')?.updatedAt;
      expect(afterDeprecate).not.toEqual(beforeDeprecate);
    });
  });

  describe('diff', () => {
    it('should detect schema changes between versions', () => {
      const v1: DataContract = {
        name: 'evolving',
        version: '1.0.0',
        owner: 'team',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'evolving',
        version: '2.0.0',
        owner: 'team',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('evolving', '1.0.0', '2.0.0');

      expect(diff).toBeDefined();
      expect(diff.changes.length).toBeGreaterThan(0);
    });

    it('should throw error when comparing non-existent versions', () => {
      expect(() => {
        registry.diff('nonexistent', '1.0.0', '2.0.0');
      }).toThrow('Cannot compare: contract versions not found');
    });

    it('should identify breaking changes', () => {
      const v1: DataContract = {
        name: 'breaking-test',
        version: '1.0.0',
        owner: 'team',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'breaking-test',
        version: '2.0.0',
        owner: 'team',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'number' }, // Type change - breaking
          },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('breaking-test', '1.0.0', '2.0.0');

      expect(diff.isBreaking).toBeDefined();
      expect(diff.breakingChanges).toBeDefined();
    });

    it('should detect field additions as non-breaking', () => {
      const v1: DataContract = {
        name: 'add-field-test',
        version: '1.0.0',
        owner: 'team',
        schema: {
          id: 'string',
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'add-field-test',
        version: '2.0.0',
        owner: 'team',
        schema: {
          id: 'string',
          name: 'string', // Field added
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('add-field-test', '1.0.0', '2.0.0');

      const addedChanges = diff.changes.filter((c) => c.changeType === 'added');
      expect(addedChanges.length).toBeGreaterThan(0);
      expect(addedChanges[0].breaking).toBe(false);
    });

    it('should detect field removals as breaking', () => {
      const v1: DataContract = {
        name: 'remove-field-test',
        version: '1.0.0',
        owner: 'team',
        schema: {
          id: 'string',
          name: 'string',
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'remove-field-test',
        version: '2.0.0',
        owner: 'team',
        schema: {
          id: 'string',
          // name removed
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('remove-field-test', '1.0.0', '2.0.0');

      const removedChanges = diff.changes.filter((c) => c.changeType === 'removed');
      expect(removedChanges.length).toBeGreaterThan(0);
      expect(removedChanges[0].breaking).toBe(true);
    });

    it('should detect field modifications as non-breaking', () => {
      const v1: DataContract = {
        name: 'modify-field-test',
        version: '1.0.0',
        owner: 'team',
        schema: {
          config: { maxLength: 100 },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'modify-field-test',
        version: '2.0.0',
        owner: 'team',
        schema: {
          config: { maxLength: 200 }, // Value modified
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('modify-field-test', '1.0.0', '2.0.0');

      const modifiedChanges = diff.changes.filter((c) => c.changeType === 'modified');
      expect(modifiedChanges.length).toBeGreaterThan(0);
      expect(modifiedChanges[0].breaking).toBe(false);
    });

    it('should detect type changes as breaking', () => {
      const v1: DataContract = {
        name: 'type-change-test',
        version: '1.0.0',
        owner: 'team',
        schema: {
          count: { type: 'number' },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const v2: DataContract = {
        name: 'type-change-test',
        version: '2.0.0',
        owner: 'team',
        schema: {
          count: 'string', // Type changed from object to string
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      registry.register(v1);
      registry.register(v2);

      const diff = registry.diff('type-change-test', '1.0.0', '2.0.0');

      const typeChanges = diff.changes.filter((c) => c.changeType === 'type_changed');
      expect(typeChanges.length).toBeGreaterThan(0);
      expect(typeChanges[0].breaking).toBe(true);
    });
  });

  describe('recordViolation', () => {
    it('should record contract violations', () => {
      registry.recordViolation({
        contractName: 'test-contract',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'Type mismatch on email field',
        details: { field: 'email', expectedType: 'string', actualType: 'number' },
        timestamp: new Date(),
      });

      const violations = registry.getViolations('test-contract');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Type mismatch on email field');
      expect(violations[0].details.field).toBe('email');
    });
  });

  describe('getViolations', () => {
    it('should return empty array when no violations', () => {
      expect(registry.getViolations('clean-contract')).toEqual([]);
    });

    it('should filter violations by contract name', () => {
      registry.recordViolation({
        contractName: 'contract-a',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'Error A',
        details: { field: 'field1' },
        timestamp: new Date(),
      });

      registry.recordViolation({
        contractName: 'contract-b',
        contractVersion: '1.0.0',
        violationType: 'sla',
        severity: 'warning',
        message: 'Error B',
        details: { field: 'field2' },
        timestamp: new Date(),
      });

      const violationsA = registry.getViolations('contract-a');
      expect(violationsA).toHaveLength(1);
      expect(violationsA[0].message).toBe('Error A');
    });

    it('should filter violations by version', () => {
      registry.recordViolation({
        contractName: 'versioned-contract',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'V1 error',
        details: {},
        timestamp: new Date(),
      });

      registry.recordViolation({
        contractName: 'versioned-contract',
        contractVersion: '2.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'V2 error',
        details: {},
        timestamp: new Date(),
      });

      const v1Violations = registry.getViolations('versioned-contract', '1.0.0');
      expect(v1Violations).toHaveLength(1);
      expect(v1Violations[0].message).toBe('V1 error');
    });
  });

  describe('clearOldViolations', () => {
    it('should clear violations older than specified days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);

      registry.recordViolation({
        contractName: 'test',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'Old violation',
        details: {},
        timestamp: oldDate,
      });

      registry.recordViolation({
        contractName: 'test',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'Recent violation',
        details: {},
        timestamp: recentDate,
      });

      registry.clearOldViolations(5);

      const violations = registry.getViolations('test');
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toBe('Recent violation');
    });

    it('should keep all violations when cutoff is 0', () => {
      registry.recordViolation({
        contractName: 'test',
        contractVersion: '1.0.0',
        violationType: 'schema',
        severity: 'error',
        message: 'Violation',
        details: {},
        timestamp: new Date(),
      });

      registry.clearOldViolations(0);

      const violations = registry.getViolations('test');
      expect(violations).toHaveLength(0);
    });

    it('should handle clearing when no violations exist', () => {
      expect(() => {
        registry.clearOldViolations(30);
      }).not.toThrow();
    });
  });
});
