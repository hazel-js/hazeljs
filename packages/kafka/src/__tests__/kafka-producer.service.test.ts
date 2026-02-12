import { KafkaProducerService } from '../kafka-producer.service';

// Mock kafkajs
const mockSend = jest.fn().mockResolvedValue(undefined);
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      send: mockSend,
    }),
  })),
}));

// Simple DI container mock for testing
const mockKafka = {
  producer: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    send: mockSend,
  }),
};

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KafkaProducerService(mockKafka as any);
  });

  describe('send', () => {
    it('should connect and send message', async () => {
      await service.send('test-topic', { value: 'hello' });
      expect(mockConnect).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          messages: expect.arrayContaining([expect.objectContaining({ value: 'hello' })]),
        })
      );
    });

    it('should send multiple messages', async () => {
      await service.send('test-topic', [
        { key: '1', value: 'msg1' },
        { key: '2', value: 'msg2' },
      ]);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ key: '1', value: 'msg1' }),
            expect.objectContaining({ key: '2', value: 'msg2' }),
          ]),
        })
      );
    });
  });

  describe('sendBatch', () => {
    it('should send to multiple topics', async () => {
      await service.sendBatch([
        { topic: 'topic-a', messages: [{ value: 'a' }] },
        { topic: 'topic-b', messages: [{ value: 'b' }] },
      ]);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('lifecycle', () => {
    it('should connect on onModuleInit', async () => {
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should disconnect on onModuleDestroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
