/**
 * @hazeljs/ml - Experiment Tracking
 *
 * Export all experiment tracking components
 */

// Core types
export type {
  Experiment as ExperimentType,
  Run,
  Artifact,
  ExperimentConfig,
  ExperimentQuery,
  RunComparison,
} from './experiment.types';

// Services
export { ExperimentService } from './experiment.service';

// Decorators
export {
  Experiment,
  getExperimentMetadata,
  hasExperimentMetadata,
  type ExperimentOptions,
  type ExperimentMetadata,
} from './experiment.decorator';
