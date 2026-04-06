import { PubSubPublisherService } from '../pubsub-publisher.service';

describe('PubSubPublisherService', () => {
  const mockPublishMessage = jest.fn();
  const mockTopic = jest.fn().mockReturnValue({
    publishMessage: mockPublishMessage,
  });
  const mockPubSub = {
    topic: mockTopic,
  };

  let service: PubSubPublisherService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishMessage.mockResolvedValue('msg-123');
    service = new PubSubPublisherService(mockPubSub as never);
  });

  it('publishes string messages', async () => {
    const messageId = await service.publish('orders', 'hello');
    expect(messageId).toBe('msg-123');
    expect(mockTopic).toHaveBeenCalledWith('orders');
    expect(mockPublishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: Buffer.from('hello'),
      })
    );
  });

  it('publishes object messages as JSON', async () => {
    await service.publish('orders', { id: 1, status: 'created' });
    expect(mockPublishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: Buffer.from(JSON.stringify({ id: 1, status: 'created' })),
      })
    );
  });

  it('passes attributes and ordering key', async () => {
    await service.publish(
      'orders',
      { id: 2 },
      { attributes: { source: 'test' }, orderingKey: 'k1' }
    );
    expect(mockPublishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        orderingKey: 'k1',
        attributes: { source: 'test' },
      })
    );
  });

  it('adds json content-type for publishJson', async () => {
    await service.publishJson('orders', { id: 10 }, { attributes: { env: 'test' } });
    expect(mockPublishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: { 'content-type': 'application/json', env: 'test' },
      })
    );
  });
});
