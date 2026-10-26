import { RedisService } from '../redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockClient: {
    ping: jest.Mock;
    quit: jest.Mock;
    duplicate: jest.Mock;
    publish: jest.Mock;
  };

  beforeEach(() => {
    service = new RedisService();
    mockClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      duplicate: jest.fn().mockReturnValue({ quit: jest.fn() }),
      publish: jest.fn().mockResolvedValue(1),
    };
  });

  it('throws when not configured', () => {
    expect(() => service.getClient()).toThrow(/not configured/);
  });

  it('setClient exposes client and ping', async () => {
    service.setClient(mockClient as never, false);
    expect(service.getClient()).toBe(mockClient);
    await expect(service.ping()).resolves.toBe('PONG');
  });

  it('duplicate delegates to client', () => {
    service.setClient(mockClient as never, false);
    service.duplicate();
    expect(mockClient.duplicate).toHaveBeenCalled();
  });

  it('disconnect quits only when owning the client', async () => {
    service.setClient(mockClient as never, true);
    await service.disconnect();
    expect(mockClient.quit).toHaveBeenCalled();
    expect(() => service.getClient()).toThrow(/not configured/);
  });

  it('disconnect does not quit injected client', async () => {
    service.setClient(mockClient as never, false);
    await service.disconnect();
    expect(mockClient.quit).not.toHaveBeenCalled();
  });
});
