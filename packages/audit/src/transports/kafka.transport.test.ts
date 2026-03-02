/// <reference types="jest" />
import { KafkaAuditTransport } from './kafka.transport';
import type { AuditEvent } from '../audit.types';
import type { KafkaAuditSender } from './kafka.transport';

describe('KafkaAuditTransport', () => {
  const baseEvent: AuditEvent = {
    action: 'order.create',
    timestamp: '2025-01-01T00:00:00.000Z',
    result: 'success',
    resource: 'Order',
    resourceId: 'ord-1',
  };

  it('should send JSON-serialized event by default', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const sender: KafkaAuditSender = { send };
    const transport = new KafkaAuditTransport({ sender, topic: 'audit' });
    await transport.log(baseEvent);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('audit', { value: JSON.stringify(baseEvent) });
  });

  it('should include key when key option is provided', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const sender: KafkaAuditSender = { send };
    const transport = new KafkaAuditTransport({
      sender,
      topic: 'audit',
      key: (e) => (e.resourceId as string) ?? '',
    });
    await transport.log(baseEvent);
    expect(send).toHaveBeenCalledWith('audit', { key: 'ord-1', value: JSON.stringify(baseEvent) });
  });

  it('should use custom serialize when provided', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const sender: KafkaAuditSender = { send };
    const transport = new KafkaAuditTransport({
      sender,
      topic: 'events',
      serialize: (e) => `custom:${e.action}`,
    });
    await transport.log(baseEvent);
    expect(send).toHaveBeenCalledWith('events', { value: 'custom:order.create' });
  });

  it('should support async serialize', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const sender: KafkaAuditSender = { send };
    const transport = new KafkaAuditTransport({
      sender,
      topic: 'audit',
      serialize: (e) => Promise.resolve(Buffer.from(JSON.stringify(e))),
    });
    await transport.log(baseEvent);
    expect(send).toHaveBeenCalledTimes(1);
    const value = send.mock.calls[0][1].value as Buffer;
    expect(Buffer.isBuffer(value)).toBe(true);
    expect(JSON.parse(value.toString())).toEqual(baseEvent);
  });

  it('should not include key when key function returns undefined', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const sender: KafkaAuditSender = { send };
    const transport = new KafkaAuditTransport({
      sender,
      topic: 'audit',
      key: () => undefined,
    });
    await transport.log(baseEvent);
    expect(send).toHaveBeenCalledWith('audit', { value: JSON.stringify(baseEvent) });
  });
});
