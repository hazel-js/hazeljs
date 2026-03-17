import { DataSource } from 'typeorm';
import * as typeorm from 'typeorm';
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

  describe('with options.options (DataSourceOptions)', () => {
    it('creates DataSource from options and initializes', async () => {
      const mockDs: MockDs = {
        isInitialized: false,
        initialize: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
        getRepository: jest.fn(() => ({})),
      };
      const spy = jest
        .spyOn(typeorm, 'DataSource')
        .mockImplementation(() => mockDs as unknown as DataSource);

      const service = new TypeOrmService({
        options: {
          type: 'sqlite',
          database: ':memory:',
          synchronize: true,
        } as import('typeorm').DataSourceOptions,
      });
      await service.ready();
      expect(service.dataSource).toBe(mockDs);
      expect(mockDs.initialize).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('when initialize() rejects', () => {
    it('surfaces error from ready() and leaves DataSource uninitialized', async () => {
      const mockDs: MockDs = {
        isInitialized: false,
        initialize: jest.fn().mockRejectedValue(new Error('connection refused')),
        destroy: jest.fn(),
        getRepository: jest.fn(() => ({})),
      };
      const dataSource = mockDs as unknown as DataSource;
      const service = new TypeOrmService({ dataSource });

      await expect(service.ready()).rejects.toThrow('connection refused');
    });
  });

  describe('when destroy() throws in onModuleDestroy', () => {
    it('logs and rethrows', async () => {
      const mockDs: MockDs = {
        isInitialized: true,
        initialize: jest.fn(),
        destroy: jest.fn().mockRejectedValue(new Error('destroy failed')),
        getRepository: jest.fn(() => ({})),
      };
      const dataSource = mockDs as unknown as DataSource;
      const service = new TypeOrmService({ dataSource });
      await service.ready();

      await expect(service.onModuleDestroy()).rejects.toThrow('destroy failed');
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
