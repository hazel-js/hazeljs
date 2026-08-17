/**
 * Multi-instance Gatekeeper — Kafka audit + Redis approvals.
 *
 * InMemoryAuditSink / InMemoryApprovalProvider are not used here:
 * they do not share state across replicas.
 */
import { KafkaAuditTransport } from '@hazeljs/audit';
import {
  AgentGatekeeper,
  CompositeAuditSink,
  ConsoleAuditSink,
  createAuditTransportSink,
  createOtelAuditSink,
  createRedisApprovalProvider,
} from '@hazeljs/agent-gatekeeper';
import { trace } from '@opentelemetry/api';
import { refundPolicy } from './refund-agent';

export function createProductionGatekeeper(deps: {
  redis: {
    get(key: string): Promise<string | null>;
    setEx(key: string, seconds: number, value: string): Promise<unknown>;
    del(key: string): Promise<unknown>;
  };
  kafkaProducer: {
    send(
      topic: string,
      messages:
        | { key?: string; value: string | Buffer }
        | Array<{ key?: string; value: string | Buffer }>
    ): Promise<void>;
  };
}): AgentGatekeeper {
  return new AgentGatekeeper({
    mode: 'enforce',
    defaultDecision: 'deny',
    policies: [refundPolicy],
    auditSink: new CompositeAuditSink([
      new ConsoleAuditSink(),
      createAuditTransportSink(
        new KafkaAuditTransport({
          sender: deps.kafkaProducer,
          topic: 'hazel.gatekeeper.audit',
          key: (event) => String(event.resourceId ?? event.actor?.id ?? ''),
        })
      ),
      createOtelAuditSink({ trace }),
    ]),
    approvalProvider: createRedisApprovalProvider(deps.redis),
  });
}
