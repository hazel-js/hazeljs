import { DataSource } from 'typeorm';
import { TypeOrmService } from './typeorm.service';

describe('TypeOrmService', () => {
  describe('with provided DataSource', () => {
    it('should use provided DataSource and initialize/destroy', async () => {
      const dataSource = {
        isInitialized: false,
        async initialize() {
          this.isInitialized = true;
        },
        async destroy() {
          this.isInitialized = false;
        },
        getRepository: jest.fn(() => ({ find: jest.fn() })),
      } as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });
      expect(service.dataSource).toBe(dataSource);

      await service.onModuleInit();
      expect(dataSource.isInitialized).toBe(true);

      await service.onModuleDestroy();
      expect(dataSource.isInitialized).toBe(false);
    });

    it('should expose getRepository', () => {
      const mockRepo = { find: jest.fn(), findOne: jest.fn() };
      const dataSource = {
        isInitialized: true,
        getRepository: jest.fn(() => mockRepo),
      } as unknown as DataSource;

      const service = new TypeOrmService({ dataSource });
      const repo = service.getRepository('dummy' as never);
      expect(repo).toBe(mockRepo);
      expect(typeof repo.find).toBe('function');
    });
  });

  describe('without options or dataSource', () => {
    const origEnv = process.env.DATABASE_URL;

    afterEach(() => {
      process.env.DATABASE_URL = origEnv;
    });

    it('should throw when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      expect(() => new TypeOrmService()).toThrow(/DATABASE_URL|options|dataSource/);
    });
  });
});
