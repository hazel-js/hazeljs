/**
 * @hazeljs/data - Data Contracts
 *
 * Export all data contract components
 */

// Core types
export type {
  ContractStatus,
  DataContract as DataContractType,
  DataContractSLA,
  ContractViolation,
  SchemaChange,
  ContractDiff,
  ContractValidationResult,
} from './contract.types';

// Services
export { ContractRegistry } from './contract-registry';

// Decorators
export {
  DataContract,
  getDataContractMetadata,
  hasDataContractMetadata,
  type DataContractOptions,
  type DataContractMetadata,
} from './contract.decorator';
