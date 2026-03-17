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

  it('should delegate findOne to TypeORM repository', async () => {
    const entity = { id: 1, name: 'a' };
    (repo['repository'].findOne as jest.Mock).mockResolvedValueOnce(entity);
    const result = await repo.findOne({ where: { id: 1 } });
    expect(result).toEqual(entity);
  });

  it('should delegate create to TypeORM repository', async () => {
    const created = { id: 1, name: 'new' };
    (repo['repository'].create as jest.Mock).mockReturnValueOnce(created);
    (repo['repository'].save as jest.Mock).mockResolvedValueOnce(created);
    const result = await repo.create({ name: 'new' });
    expect(repo['repository'].create).toHaveBeenCalledWith({ name: 'new' });
    expect(repo['repository'].save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });

  it('should delegate save to TypeORM repository', async () => {
    const entity = { id: 1, name: 'updated' };
    (repo['repository'].save as jest.Mock).mockResolvedValueOnce(entity);
    const result = await repo.save(entity);
    expect(result).toEqual(entity);
  });

  it('should delegate update to TypeORM repository', async () => {
    (repo['repository'].update as jest.Mock).mockResolvedValueOnce(undefined);
    await repo.update({ id: 1 }, { name: 'updated' });
    expect(repo['repository'].update).toHaveBeenCalledWith({ id: 1 }, { name: 'updated' });
  });

  it('should delegate delete to TypeORM repository', async () => {
    (repo['repository'].delete as jest.Mock).mockResolvedValueOnce(undefined);
    await repo.delete({ id: 1 });
    expect(repo['repository'].delete).toHaveBeenCalledWith({ id: 1 });
  });

  it('should call find with empty options when options undefined', async () => {
    (repo['repository'].find as jest.Mock).mockClear();
    (repo['repository'].find as jest.Mock).mockResolvedValueOnce([]);
    await repo.find();
    expect(repo['repository'].find).toHaveBeenCalledWith({});
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

    it('should map unique constraint 23505 with constraint name', () => {
      const err = new Error('duplicate') as Error & { code: string; constraint?: string };
      err.code = '23505';
      err.constraint = 'users_email_key';
      expect(() => repo['handleError'](err)).toThrow('users_email_key');
    });

    it('should map foreign key code 23503', () => {
      const err = new Error('fk') as Error & { code: string };
      err.code = '23503';
      expect(() => repo['handleError'](err)).toThrow('Foreign key constraint violation');
    });

    it('should map EntityNotFoundError by name', () => {
      const err = new Error('not found') as Error & { name: string };
      err.name = 'EntityNotFoundError';
      expect(() => repo['handleError'](err)).toThrow('Record not found');
    });
  });

  describe('error propagation', () => {
    it('should call handleError when findOne throws', async () => {
      (repo['repository'].findOne as jest.Mock).mockRejectedValueOnce(new Error('db fail'));
      await expect(repo.findOne({ where: { id: 1 } })).rejects.toThrow('Database error: db fail');
    });

    it('should call handleError when create/save throws', async () => {
      (repo['repository'].create as jest.Mock).mockReturnValue({});
      (repo['repository'].save as jest.Mock).mockRejectedValueOnce(new Error('insert fail'));
      await expect(repo.create({ name: 'x' })).rejects.toThrow('Database error: insert fail');
    });

    it('should call handleError when save (entity) throws', async () => {
      (repo['repository'].save as jest.Mock).mockRejectedValueOnce(new Error('save fail'));
      await expect(repo.save({ id: 1, name: 'x' })).rejects.toThrow('Database error: save fail');
    });

    it('should call handleError when update throws', async () => {
      (repo['repository'].update as jest.Mock).mockRejectedValueOnce(new Error('update fail'));
      await expect(repo.update({ id: 1 }, { name: 'y' })).rejects.toThrow(
        'Database error: update fail'
      );
    });

    it('should call handleError when delete throws', async () => {
      (repo['repository'].delete as jest.Mock).mockRejectedValueOnce(new Error('delete fail'));
      await expect(repo.delete({ id: 1 })).rejects.toThrow('Database error: delete fail');
    });

    it('should call handleError when count throws', async () => {
      (repo['repository'].count as jest.Mock).mockRejectedValueOnce(new Error('count fail'));
      await expect(repo.count({})).rejects.toThrow('Database error: count fail');
    });
  });
});
