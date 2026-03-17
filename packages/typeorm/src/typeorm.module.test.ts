import { TypeOrmModule } from './typeorm.module';
import { TypeOrmService } from './typeorm.service';
import * as typeorm from 'typeorm';

describe('TypeOrmModule', () => {
  it('should export TypeOrmModule class', () => {
    expect(TypeOrmModule).toBeDefined();
  });

  describe('forRoot', () => {
    it('should return dynamic module with module, providers, exports', () => {
      const result = TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        synchronize: true,
      });

      expect(result).toHaveProperty('module', TypeOrmModule);
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('exports');
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers![0]).toMatchObject({
        provide: TypeOrmService,
        useFactory: expect.any(Function),
      });
      expect(result.exports).toContain(TypeOrmService);
    });

    it('should provide TypeOrmService via useFactory returning new DataSource', () => {
      const result = TypeOrmModule.forRoot({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'u',
        password: 'p',
        database: 'd',
      });

      const provider = result.providers![0] as { useFactory: () => TypeOrmService };
      expect(provider.useFactory).toBeDefined();
      expect(typeof provider.useFactory).toBe('function');
    });

    it('useFactory creates DataSource and TypeOrmService (forRoot body coverage)', async () => {
      const mockDs = {
        isInitialized: false,
        initialize: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
        getRepository: jest.fn(() => ({})),
      };
      const spy = jest.spyOn(typeorm, 'DataSource').mockImplementation(() => mockDs as any);

      const result = TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        synchronize: true,
      });

      const provider = result.providers![0] as { useFactory: () => TypeOrmService };
      const service = provider.useFactory();
      expect(service).toBeDefined();
      expect(service.ready).toBeDefined();
      await service.ready();
      expect(service.dataSource).toBe(mockDs);
      expect(mockDs.initialize).toHaveBeenCalledTimes(1);
      await service.onModuleDestroy();
      spy.mockRestore();
    });
  });
});
