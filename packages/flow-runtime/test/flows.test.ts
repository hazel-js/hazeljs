import { describe, it, expect } from 'vitest';
import { demoFraudFlow, demoSupportFlow } from '../src/flows/index.js';

describe('demoFraudFlow', () => {
  it('has correct flowId and version', () => {
    expect(demoFraudFlow.flowId).toBe('demo-fraud');
    expect(demoFraudFlow.version).toBe('1.0.0');
  });

  it('has entry and nodes', () => {
    expect(demoFraudFlow.entry).toBe('score');
    expect(Object.keys(demoFraudFlow.nodes)).toContain('score');
    expect(Object.keys(demoFraudFlow.nodes)).toContain('approve');
    expect(Object.keys(demoFraudFlow.nodes)).toContain('review');
    expect(Object.keys(demoFraudFlow.nodes)).toContain('reject');
  });

  it('has edges from score', () => {
    const scoreEdges = demoFraudFlow.edges.filter((e) => e.from === 'score');
    expect(scoreEdges.length).toBe(3);
  });
});

describe('demoSupportFlow', () => {
  it('has correct flowId and version', () => {
    expect(demoSupportFlow.flowId).toBe('demo-support');
    expect(demoSupportFlow.version).toBe('1.0.0');
  });

  it('has create and notify nodes', () => {
    expect(demoSupportFlow.entry).toBe('create');
    expect(Object.keys(demoSupportFlow.nodes)).toContain('create');
    expect(Object.keys(demoSupportFlow.nodes)).toContain('notify');
  });
});
