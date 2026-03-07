import { describe, it, expect } from 'vitest';
import {
  FlowError,
  LockBusyError,
  AmbiguousEdgeError,
  FlowNotFoundError,
  RunNotFoundError,
} from '../src/types/Errors.js';

describe('FlowError', () => {
  it('creates error with message and code', () => {
    const err = new FlowError('test', 'TEST_CODE');
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.retryable).toBe(false);
  });

  it('supports retryable flag', () => {
    const err = new FlowError('retry', 'RETRY', true);
    expect(err.retryable).toBe(true);
  });
});

describe('LockBusyError', () => {
  it('extends FlowError with LOCK_BUSY code', () => {
    const err = new LockBusyError('run-123');
    expect(err).toBeInstanceOf(FlowError);
    expect(err.message).toBe('Lock busy for run run-123');
    expect(err.code).toBe('LOCK_BUSY');
    expect(err.retryable).toBe(true);
  });
});

describe('AmbiguousEdgeError', () => {
  it('extends FlowError with AMBIGUOUS_EDGE code', () => {
    const err = new AmbiguousEdgeError('node-a');
    expect(err).toBeInstanceOf(FlowError);
    expect(err.message).toBe('Ambiguous edge from node node-a');
    expect(err.code).toBe('AMBIGUOUS_EDGE');
    expect(err.retryable).toBe(false);
  });
});

describe('FlowNotFoundError', () => {
  it('extends FlowError with FLOW_NOT_FOUND code', () => {
    const err = new FlowNotFoundError('flow-1', '1.0.0');
    expect(err).toBeInstanceOf(FlowError);
    expect(err.message).toBe('Flow not found: flow-1@1.0.0');
    expect(err.code).toBe('FLOW_NOT_FOUND');
  });
});

describe('RunNotFoundError', () => {
  it('extends FlowError with RUN_NOT_FOUND code', () => {
    const err = new RunNotFoundError('run-xyz');
    expect(err).toBeInstanceOf(FlowError);
    expect(err.message).toBe('Run not found: run-xyz');
    expect(err.code).toBe('RUN_NOT_FOUND');
  });
});
