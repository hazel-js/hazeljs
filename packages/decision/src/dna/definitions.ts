/**
 * Shared Decision DNA for incident remediation demos and tests.
 */

import type { AgentDnaDecision } from '@hazeljs/agent';

export const incidentRemediationDefinition: AgentDnaDecision = {
  version: '3',
  objective: 'Choose the safest response to this production incident',
  choices: ['retry', 'rollback', 'escalate', 'ignore'],
  risk: { level: 'high', impact: 'production', reversible: true },
  strategy: { mode: 'auto' },
  provider: 'hazel-agent',
  confidence: { high: 0.95, medium: 0.7 },
  policy: [
    { when: { confidence: { gte: 0.95 } }, action: 'allow' },
    { when: { confidence: { gte: 0.7, lt: 0.95 } }, action: 'critique' },
    { when: { confidence: { lt: 0.7 } }, action: 'review' },
  ],
  evidence: {
    required: ['error-rate-change', 'recent-deployment', 'failed-health-checks'],
    projections: [
      {
        key: 'error-rate-change',
        from: 'errorRate',
        transform: { type: 'delta', against: 'previousErrorRate' },
        relevance: 0.98,
      },
      {
        key: 'error-rate-ratio',
        from: 'errorRate',
        transform: { type: 'ratio', against: 'previousErrorRate' },
        relevance: 0.9,
      },
      {
        key: 'recent-deployment',
        from: 'deployment.ageMinutes',
        transform: { type: 'boolean', lte: 15 },
        relevance: 0.91,
      },
      {
        key: 'failed-health-checks',
        from: 'failedHealthChecks',
        transform: { type: 'value' },
        relevance: 0.95,
      },
      {
        key: 'high-traffic',
        from: 'traffic.requestsPerSecond',
        transform: { type: 'boolean', gte: 1000 },
        relevance: 0.6,
      },
    ],
  },
  scoring: {
    rollback: [
      { evidenceKey: 'error-rate-change', weight: 0.4, when: 'gt0' },
      { evidenceKey: 'recent-deployment', weight: 0.35, when: 'truthy' },
      { evidenceKey: 'failed-health-checks', weight: 0.25, when: 'gt0' },
    ],
    escalate: [
      { evidenceKey: 'failed-health-checks', weight: 0.4, when: 'gt0' },
      { evidenceKey: 'high-traffic', weight: 0.3, when: 'truthy' },
      { evidenceKey: 'error-rate-change', weight: 0.2, when: 'gt0' },
    ],
    retry: [
      { evidenceKey: 'recent-deployment', weight: -0.5, when: 'truthy' },
      { evidenceKey: 'error-rate-change', weight: -0.3, when: 'gt0' },
    ],
    ignore: [
      { evidenceKey: 'error-rate-change', weight: -0.8, when: 'gt0' },
      { evidenceKey: 'failed-health-checks', weight: -0.5, when: 'gt0' },
    ],
  },
  execution: {
    rollback: { capability: 'deployment.rollback' },
    retry: { capability: 'service.retry' },
    escalate: { capability: 'incident.escalate' },
  },
  slo: { p95LatencyMs: 500, maxReviewRate: 0.1, maxFailureRate: 0.001 },
};

export const incidentState = {
  service: 'checkout',
  errorRate: 0.38,
  previousErrorRate: 0.01,
  deployment: {
    ageMinutes: 4,
    version: '2026.09.23.4',
  },
  failedHealthChecks: 8,
  traffic: {
    requestsPerSecond: 2100,
  },
};

export const refundDefinition: AgentDnaDecision = {
  version: '5',
  objective: 'Determine whether the requested refund should proceed',
  choices: ['approve', 'reject', 'review'],
  risk: 'high',
  strategy: { mode: 'deliberate' },
  provider: 'hazel-agent',
  confidence: { high: 0.95, medium: 0.7 },
  evidence: {
    required: ['amount', 'priorRefunds'],
    projections: [
      { key: 'amount', from: 'amount', relevance: 1 },
      { key: 'priorRefunds', from: 'refundHistory.count', relevance: 0.8 },
      {
        key: 'large-refund',
        from: 'amount',
        transform: { type: 'boolean', gte: 5000 },
        relevance: 0.95,
      },
    ],
  },
  scoring: {
    approve: [
      { evidenceKey: 'large-refund', weight: -0.8, when: 'truthy' },
      { evidenceKey: 'priorRefunds', weight: -0.2, when: 'gt0' },
    ],
    reject: [{ evidenceKey: 'priorRefunds', weight: 0.3, when: 'gt0' }],
    review: [
      { evidenceKey: 'large-refund', weight: 0.9, when: 'truthy' },
      { evidenceKey: 'amount', weight: 0.4, when: 'gt0' },
    ],
  },
  onTie: 'review',
  execution: {
    approve: { capability: 'payments.refund' },
    review: { hitl: true },
  },
};
