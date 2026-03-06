import { DataSource } from 'typeorm';
import { TypeOrmService } from './typeorm.service';

interface MockDs {
  isInitialized: boolean;
  initialize: jest.Mock;
  destroy: jest.Mock;
  getRepository: jest.Mock;
}

describe('TypeOrmService', () => {
  describe('with provided DataSource', () => {
    it('auto-initialises the DataSource on construction', async () => {
      const mockDs: MockDs = {
        isInitialized: false,
        initialize: jest.fn(async function (this: MockDs) {
          this.isInitialized = true;
        }),
        destroy: jest.fn(async function (this: MockDs) {
          this.isInitialized = false;
        }),
        getRepository: jest.fn(() => ({ find: jest.fn() })),
      };
      const dataSource = mockDs as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });

      // ready() / onModuleInit() both resolve once initialization completes
      await service.ready();
      expect(mockDs.initialize).toHaveBeenCalledTimes(1);
      expect(dataSource.isInitialized).toBe(true);

      // onModuleInit() is idempotent — does not re-initialize
      await service.onModuleInit();
      expect(mockDs.initialize).toHaveBeenCalledTimes(1);
    });

    it('skips re-initialization when DataSource is already initialized', async () => {
      const mockDs: MockDs = {
        isInitialized: true,
        initialize: jest.fn(),
        destroy: jest.fn(async function (this: MockDs) {
          this.isInitialized = false;
        }),
        getRepository: jest.fn(() => ({})),
      };
      const dataSource = mockDs as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });
      await service.ready();

      expect(mockDs.initialize).not.toHaveBeenCalled();
    });

    it('destroys the DataSource on onModuleDestroy', async () => {
      const mockDs: MockDs = {
        isInitialized: true,
        initialize: jest.fn(),
        destroy: jest.fn(async function (this: MockDs) {
          this.isInitialized = false;
        }),
        getRepository: jest.fn(() => ({})),
      };
      const dataSource = mockDs as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });
      await service.onModuleDestroy();

      expect(mockDs.destroy).toHaveBeenCalledTimes(1);
      expect(dataSource.isInitialized).toBe(false);
    });

    it('exposes getRepository', async () => {
      const mockRepo = { find: jest.fn(), findOne: jest.fn() };
      const dataSource = {
        isInitialized: true,
        getRepository: jest.fn(() => mockRepo),
      } as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });
      await service.ready();

      const repo = service.getRepository('dummy' as never);
      expect(repo).toBe(mockRepo);
    });
  });

  describe('without options or dataSource', () => {
    const origEnv = process.env.DATABASE_URL;

    afterEach(() => {
      process.env.DATABASE_URL = origEnv;
    });

    it('throws when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      expect(() => new TypeOrmService()).toThrow(/DATABASE_URL|options|dataSource/);
    });
  });
});
