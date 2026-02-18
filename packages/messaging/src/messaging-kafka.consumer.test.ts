/**
 * MessagingKafkaConsumer tests - tests handleIncoming logic without Kafka
 */
import { MessagingKafkaConsumer } from './messaging-kafka.consumer';
import { MessagingService } from './messaging.service';
import type { IChannelAdapter } from './types/message.types';

describe('MessagingKafkaConsumer', () => {
  let messagingService: MessagingService;
  let mockAdapter: IChannelAdapter;

  beforeEach(() => {
    messagingService = new MessagingService({
      customHandler: jest.fn().mockResolvedValue('Kafka reply'),
    });
    mockAdapter = {
      channel: 'telegram',
      parseIncoming: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('processes valid payload and sends reply', async () => {
    const consumer = new MessagingKafkaConsumer(messagingService, [mockAdapter]);
    const payload = {
      message: {
        value: Buffer.from(
          JSON.stringify({
            message: {
              id: '1',
              channel: 'telegram',
              conversationId: 'conv-1',
              userId: 'u1',
              text: 'Hello',
              timestamp: new Date().toISOString(),
            },
            channel: 'telegram',
          })
        ),
      },
    };

    await consumer.handleIncoming(payload as never);

    expect(mockAdapter.send).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      text: 'Kafka reply',
      replyToMessageId: '1',
    });
  });

  it('does nothing when message value is empty', async () => {
    const consumer = new MessagingKafkaConsumer(messagingService, [mockAdapter]);
    const payload = { message: { value: null } };

    await consumer.handleIncoming(payload as never);

    expect(mockAdapter.send).not.toHaveBeenCalled();
  });

  it('does nothing when message value is undefined', async () => {
    const consumer = new MessagingKafkaConsumer(messagingService, [mockAdapter]);
    const payload = { message: {} };

    await consumer.handleIncoming(payload as never);

    expect(mockAdapter.send).not.toHaveBeenCalled();
  });

  it('handles invalid JSON gracefully', async () => {
    const consumer = new MessagingKafkaConsumer(messagingService, [mockAdapter]);
    const payload = { message: { value: Buffer.from('not json') } };

    await expect(consumer.handleIncoming(payload as never)).resolves.not.toThrow();
    expect(mockAdapter.send).not.toHaveBeenCalled();
  });

  it('does not send when no adapter for channel', async () => {
    const consumer = new MessagingKafkaConsumer(messagingService, [mockAdapter]);
    const payload = {
      message: {
        value: Buffer.from(
          JSON.stringify({
            message: {
              id: '1',
              channel: 'whatsapp',
              conversationId: 'c1',
              userId: 'u1',
              text: 'Hi',
              timestamp: new Date().toISOString(),
            },
            channel: 'whatsapp',
          })
        ),
      },
    };

    await consumer.handleIncoming(payload as never);

    expect(mockAdapter.send).not.toHaveBeenCalled();
  });

  it('throws when handleMessage fails to allow Kafka retry', async () => {
    const failingService = new MessagingService({
      customHandler: jest.fn().mockRejectedValue(new Error('Service error')),
    });
    const consumer = new MessagingKafkaConsumer(failingService, [mockAdapter]);
    const payload = {
      message: {
        value: Buffer.from(
          JSON.stringify({
            message: {
              id: '1',
              channel: 'telegram',
              conversationId: 'c1',
              userId: 'u1',
              text: 'Hi',
              timestamp: new Date().toISOString(),
            },
            channel: 'telegram',
          })
        ),
      },
    };

    await expect(consumer.handleIncoming(payload as never)).rejects.toThrow('Service error');
  });

  it('does not send when handleMessage returns empty', async () => {
    const emptyService = new MessagingService({
      customHandler: jest.fn().mockResolvedValue(''),
    });
    const consumer = new MessagingKafkaConsumer(emptyService, [mockAdapter]);
    const payload = {
      message: {
        value: Buffer.from(
          JSON.stringify({
            message: {
              id: '1',
              channel: 'telegram',
              conversationId: 'c1',
              userId: 'u1',
              text: 'Hi',
              timestamp: new Date().toISOString(),
            },
            channel: 'telegram',
          })
        ),
      },
    };

    await consumer.handleIncoming(payload as never);

    expect(mockAdapter.send).not.toHaveBeenCalled();
  });
});
