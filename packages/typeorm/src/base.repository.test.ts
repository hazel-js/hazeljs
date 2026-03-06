import { BaseRepository } from './base.repository';
import { TypeOrmService } from './typeorm.service';

class TestEntity {
  id!: number;
  name!: string;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(typeOrm: TypeOrmService) {
    super(typeOrm, TestEntity);
  }
}

describe('BaseRepository', () => {
  let typeOrm: TypeOrmService;
  let repo: TestRepository;

  beforeAll(() => {
    const mockRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    const dataSource = {
      isInitialized: true,
      getRepository: jest.fn(() => mockRepository),
    } as unknown as import('typeorm').DataSource;
    typeOrm = new TypeOrmService({ dataSource });
    repo = new TestRepository(typeOrm);
  });

  it('should expose repository getter', () => {
    expect(repo['repository']).toBeDefined();
    expect(repo['repository'].find).toBeDefined();
  });

  it('should delegate find to TypeORM repository', async () => {
    const result = await repo.find({});
    expect(Array.isArray(result)).toBe(true);
  });

  it('should delegate count to TypeORM repository', async () => {
    const result = await repo.count({});
    expect(typeof result).toBe('number');
    expect(result).toBe(0);
  });

  describe('handleError', () => {
    it('should throw on generic error', () => {
      expect(() => repo['handleError'](new Error('db error'))).toThrow('Database error: db error');
    });

    it('should map unique constraint code 23505', () => {
      const err = new Error('duplicate') as Error & { code: string };
      err.code = '23505';
      expect(() => repo['handleError'](err)).toThrow(/Unique constraint/);
    });

    it('should map foreign key code 23503', () => {
      const err = new Error('fk') as Error & { code: string };
      err.code = '23503';
      expect(() => repo['handleError'](err)).toThrow('Foreign key constraint violation');
    });
  });
});
