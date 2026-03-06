import { KafkaStreamProcessor } from '../kafka-stream.processor';

// Mock kafkajs
const mockConsumerConnect = jest.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = jest.fn().mockResolvedValue(undefined);
const mockConsumerSubscribe = jest.fn().mockResolvedValue(undefined);
let capturedEachMessage:
  | ((ctx: {
      message: { key: Buffer | null; value: Buffer | null; headers: Record<string, string> };
    }) => Promise<void>)
  | undefined;
const mockConsumerRun = jest
  .fn()
  .mockImplementation(async ({ eachMessage }: { eachMessage: (ctx: unknown) => Promise<void> }) => {
    capturedEachMessage = eachMessage as typeof capturedEachMessage;
  });

const mockProducerConnect = jest.fn().mockResolvedValue(undefined);
const mockProducerDisconnect = jest.fn().mockResolvedValue(undefined);
const mockProducerSend = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => ({ Kafka: jest.fn() }));

const mockKafka = {
  consumer: jest.fn().mockReturnValue({
    connect: mockConsumerConnect,
    disconnect: mockConsumerDisconnect,
    subscribe: mockConsumerSubscribe,
    run: mockConsumerRun,
  }),
  producer: jest.fn().mockReturnValue({
    connect: mockProducerConnect,
    disconnect: mockProducerDisconnect,
    send: mockProducerSend,
  }),
};

describe('KafkaStreamProcessor', () => {
  let processor: KafkaStreamProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEachMessage = undefined;

    mockConsumerConnect.mockResolvedValue(undefined);
    mockConsumerDisconnect.mockResolvedValue(undefined);
    mockConsumerSubscribe.mockResolvedValue(undefined);
    mockConsumerRun.mockImplementation(
      async ({ eachMessage }: { eachMessage: (ctx: unknown) => Promise<void> }) => {
        capturedEachMessage = eachMessage as typeof capturedEachMessage;
      }
    );
    mockProducerConnect.mockResolvedValue(undefined);
    mockProducerDisconnect.mockResolvedValue(undefined);
    mockProducerSend.mockResolvedValue(undefined);

    mockKafka.consumer.mockReturnValue({
      connect: mockConsumerConnect,
      disconnect: mockConsumerDisconnect,
      subscribe: mockConsumerSubscribe,
      run: mockConsumerRun,
    });
    mockKafka.producer.mockReturnValue({
      connect: mockProducerConnect,
      disconnect: mockProducerDisconnect,
      send: mockProducerSend,
    });

    processor = new KafkaStreamProcessor(mockKafka as never);
  });

  describe('fluent API', () => {
    it('from() returns this (chainable)', () => {
      expect(processor.from('input-topic')).toBe(processor);
    });

    it('from() can be called again to update inputTopic', () => {
      processor.from('first');
      expect(processor.from('second')).toBe(processor);
    });

    it('transform() returns this (chainable)', () => {
      processor.from('input');
      expect(processor.transform(async (msg) => ({ value: msg.value }))).toBe(processor);
    });

    it('to() returns this (chainable)', () => {
      processor.from('input');
      expect(processor.to('output')).toBe(processor);
    });

    it('withGroupId() returns this (chainable)', () => {
      processor.from('input');
      expect(processor.withGroupId('my-group')).toBe(processor);
    });

    it('transform() throws when called before from()', () => {
      expect(() => processor.transform(async (msg) => ({ value: msg.value }))).toThrow(
        'Call from(topic) before transform()'
      );
    });

    it('to() throws when called before from()', () => {
      expect(() => processor.to('output')).toThrow('Call from(topic) before to()');
    });

    it('withGroupId() throws when called before from()', () => {
      expect(() => processor.withGroupId('group')).toThrow('Call from(topic) before withGroupId()');
    });
  });

  describe('isProcessorRunning()', () => {
    it('returns false initially', () => {
      expect(processor.isProcessorRunning()).toBe(false);
    });
  });

  describe('start()', () => {
    it('throws when pipeline is not configured', async () => {
      await expect(processor.start()).rejects.toThrow('Pipeline not configured');
    });

    it('starts the processor and sets isRunning', async () => {
      processor.from('input').to('output');
      await processor.start();

      expect(mockConsumerConnect).toHaveBeenCalled();
      expect(mockProducerConnect).toHaveBeenCalled();
      expect(mockConsumerSubscribe).toHaveBeenCalledWith({
        topics: ['input'],
        fromBeginning: false,
      });
      expect(processor.isProcessorRunning()).toBe(true);
    });

    it('is idempotent (second start() is no-op)', async () => {
      processor.from('input').to('output');
      await processor.start();
      await processor.start();

      expect(mockConsumerConnect).toHaveBeenCalledTimes(1);
    });

    it('uses custom groupId when provided', async () => {
      processor.from('input').to('output').withGroupId('custom-group');
      await processor.start();

      expect(mockKafka.consumer).toHaveBeenCalledWith({ groupId: 'custom-group' });
    });

    it('generates default groupId from topic names', async () => {
      processor.from('in-topic').to('out-topic');
      await processor.start();

      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: 'stream-in-topic-out-topic',
      });
    });

    it('produces transformed message to output topic', async () => {
      processor
        .from('in')
        .transform(async (msg) => ({ value: Buffer.from(`processed:${msg.value?.toString()}`) }))
        .to('out');
      await processor.start();

      await capturedEachMessage!({
        message: { key: Buffer.from('key1'), value: Buffer.from('hello'), headers: {} },
      });

      expect(mockProducerSend).toHaveBeenCalledWith(expect.objectContaining({ topic: 'out' }));
    });

    it('skips producing when transform returns null', async () => {
      processor
        .from('in')
        .transform(async () => null)
        .to('out');
      await processor.start();

      await capturedEachMessage!({
        message: { key: null, value: Buffer.from('data'), headers: {} },
      });

      expect(mockProducerSend).not.toHaveBeenCalled();
    });

    it('serializes non-buffer/string output to JSON', async () => {
      processor
        .from('in')
        .transform(async () => ({ value: { nested: 'obj' } }))
        .to('out');
      await processor.start();

      await capturedEachMessage!({
        message: { key: null, value: Buffer.from('in'), headers: {} },
      });

      const sentMsg = mockProducerSend.mock.calls[0][0].messages[0];
      expect(sentMsg.value).toBe('{"nested":"obj"}');
    });

    it('passes string value through as-is', async () => {
      processor
        .from('in')
        .transform(async () => ({ value: 'plain-text' }))
        .to('out');
      await processor.start();

      await capturedEachMessage!({
        message: { key: null, value: Buffer.from('in'), headers: {} },
      });

      const sentMsg = mockProducerSend.mock.calls[0][0].messages[0];
      expect(sentMsg.value).toBe('plain-text');
    });

    it('passes Buffer value through as-is', async () => {
      const buf = Buffer.from('raw');
      processor
        .from('in')
        .transform(async () => ({ value: buf }))
        .to('out');
      await processor.start();

      await capturedEachMessage!({
        message: { key: null, value: Buffer.from('in'), headers: {} },
      });

      const sentMsg = mockProducerSend.mock.calls[0][0].messages[0];
      expect(sentMsg.value).toBe(buf);
    });

    it('uses original message value when transform output value is null', async () => {
      processor
        .from('in')
        .transform(async (msg) => ({ value: null, key: msg.key }))
        .to('out');
      await processor.start();

      const origValue = Buffer.from('original');
      await capturedEachMessage!({
        message: { key: null, value: origValue, headers: {} },
      });

      const sentMsg = mockProducerSend.mock.calls[0][0].messages[0];
      expect(sentMsg.value).toBe(origValue);
    });

    it('handles transform errors by re-throwing', async () => {
      processor
        .from('in')
        .transform(async () => {
          throw new Error('transform failed');
        })
        .to('out');
      await processor.start();

      await expect(
        capturedEachMessage!({
          message: { key: null, value: Buffer.from('x'), headers: {} },
        })
      ).rejects.toThrow('transform failed');
    });

    it('uses identity transform when no transform() is called', async () => {
      processor.from('in').to('out');
      await processor.start();

      const val = Buffer.from('unchanged');
      await capturedEachMessage!({
        message: { key: null, value: val, headers: {} },
      });

      expect(mockProducerSend).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('does nothing when processor is not running', async () => {
      await processor.stop();
      expect(mockConsumerDisconnect).not.toHaveBeenCalled();
    });

    it('disconnects both consumer and producer', async () => {
      processor.from('in').to('out');
      await processor.start();
      await processor.stop();

      expect(mockConsumerDisconnect).toHaveBeenCalled();
      expect(mockProducerDisconnect).toHaveBeenCalled();
      expect(processor.isProcessorRunning()).toBe(false);
    });

    it('resets pipelineConfig after stop', async () => {
      processor.from('in').to('out');
      await processor.start();
      await processor.stop();

      // Can start a new pipeline after stop
      processor.from('new-in').to('new-out');
      await processor.start();
      expect(processor.isProcessorRunning()).toBe(true);
    });
  });
});
