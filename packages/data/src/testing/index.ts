/**
 * Testing utilities for @hazeljs/data pipelines.
 *
 * - SchemaFaker: generate fake data from schemas
 * - PipelineTestHarness: run pipelines and capture per-step events
 * - MockSource / MockSink: use MemorySource and MemorySink from connectors
 */

export { SchemaFaker } from './schema-faker';
export { PipelineTestHarness } from './pipeline-test-harness';
export type { StepSnapshot, PipelineRunResult } from './pipeline-test-harness';

// Re-export in-memory connectors as mock source/sink for tests
export { MemorySource as MockSource, MemorySink as MockSink } from '../connectors/memory.connector';
