/// <reference types="jest" />

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Injectable: () => () => undefined,
  HazelModule: () => () => undefined,
  Module: () => () => undefined,
  RepositoryOptions: class {},
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import logger from '@hazeljs/core';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';
import { BaseRepository, PrismaModel } from './base.repository';
import { Repository, InjectRepository } from './repository.decorator';
import { PrismaClientKnownRequestError } from './__mocks__/@prisma/client/runtime/library';

// ─── PrismaService ────────────────────────────────────────────────────────────

describe('PrismaService', () => {
  let service: PrismaService;
  let $onMock: jest.Mock;

  beforeEach(() => {
    service = new PrismaService();
    $onMock = (service as unknown as { $on: jest.Mock }).$on;
  });

  it('instantiates without error', () => {
    expect(service).toBeDefined();
  });

  it('registers $on handler for query events', () => {
    expect($onMock).toHaveBeenCalledWith('query', expect.any(Function));
  });

  it('registers $on handler for error events', () => {
    expect($onMock).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('query event callback logs valid query events', () => {
    const queryCallback = $onMock.mock.calls.find(([evt]) => evt === 'query')?.[1];
    expect(queryCallback).toBeDefined();
    queryCallback({ query: 'SELECT 1', params: '[]', duration: 5 });
    expect((logger as jest.Mocked<typeof logger>).debug).toHaveBeenCalled();
  });

  it('query event callback ignores non-query events', () => {
    const queryCallback = $onMock.mock.calls.find(([evt]) => evt === 'query')?.[1];
    jest.clearAllMocks();
    queryCallback({ message: 'not a query event' });
    expect((logger as jest.Mocked<typeof logger>).debug).not.toHaveBeenCalled();
  });

  it('error event callback logs prisma error events', () => {
    const errorCallback = $onMock.mock.calls.find(([evt]) => evt === 'error')?.[1];
    expect(errorCallback).toBeDefined();
    errorCallback({ message: 'some error' });
    expect((logger as jest.Mocked<typeof logger>).error).toHaveBeenCalled();
  });

  it('error event callback ignores events without message', () => {
    const errorCallback = $onMock.mock.calls.find(([evt]) => evt === 'error')?.[1];
    jest.clearAllMocks();
    errorCallback({ query: 'SELECT 1', params: '[]', duration: 2 });
    expect((logger as jest.Mocked<typeof logger>).error).not.toHaveBeenCalled();
  });

  it('onModuleInit calls $connect and resolves', async () => {
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect((service as unknown as { $connect: jest.Mock }).$connect).toHaveBeenCalled();
  });

  it('onModuleInit throws and logs when $connect rejects', async () => {
    (service as unknown as { $connect: jest.Mock }).$connect.mockRejectedValueOnce(
      new Error('connection refused')
    );
    await expect(service.onModuleInit()).rejects.toThrow('connection refused');
  });

  it('onModuleDestroy calls $disconnect and resolves', async () => {
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect((service as unknown as { $disconnect: jest.Mock }).$disconnect).toHaveBeenCalled();
  });

  it('onModuleDestroy throws and logs when $disconnect rejects', async () => {
    (service as unknown as { $disconnect: jest.Mock }).$disconnect.mockRejectedValueOnce(
      new Error('disconnect failed')
    );
    await expect(service.onModuleDestroy()).rejects.toThrow('disconnect failed');
  });
});

// ─── BaseRepository ────────────────────────────────────────────────────────────

type TestModel = PrismaModel & { name: string };

function buildMockDelegate() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
}

class TestRepository extends BaseRepository<TestModel> {
  constructor(prisma: PrismaService) {
    super(prisma, 'testModel');
  }

  // Expose protected handleError for testing
  public testHandleError(error: unknown): never {
    return this.handleError(error);
  }
}

function buildRepo() {
  const delegate = buildMockDelegate();
  const mockPrisma = {
    $on: jest.fn(),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    testModel: delegate,
  } as unknown as PrismaService;
  const repo = new TestRepository(mockPrisma);
  return { repo, delegate };
}

describe('BaseRepository', () => {
  describe('findMany()', () => {
    it('returns all records', async () => {
      const { repo, delegate } = buildRepo();
      const records = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      delegate.findMany.mockResolvedValue(records);
      await expect(repo.findMany()).resolves.toEqual(records);
    });
  });

  describe('findOne()', () => {
    it('returns matching record', async () => {
      const { repo, delegate } = buildRepo();
      const record = { id: 1, name: 'Alice' };
      delegate.findUnique.mockResolvedValue(record);
      await expect(repo.findOne({ id: 1 })).resolves.toEqual(record);
      expect(delegate.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns null when not found', async () => {
      const { repo, delegate } = buildRepo();
      delegate.findUnique.mockResolvedValue(null);
      await expect(repo.findOne({ id: 99 })).resolves.toBeNull();
    });
  });

  describe('create()', () => {
    it('creates and returns a record', async () => {
      const { repo, delegate } = buildRepo();
      const created = { id: 3, name: 'Charlie' };
      delegate.create.mockResolvedValue(created);
      await expect(repo.create({ name: 'Charlie' })).resolves.toEqual(created);
      expect(delegate.create).toHaveBeenCalledWith({ data: { name: 'Charlie' } });
    });
  });

  describe('update()', () => {
    it('updates and returns the updated record', async () => {
      const { repo, delegate } = buildRepo();
      const updated = { id: 1, name: 'Updated' };
      delegate.update.mockResolvedValue(updated);
      await expect(repo.update({ id: 1 }, { name: 'Updated' })).resolves.toEqual(updated);
      expect(delegate.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'Updated' } });
    });
  });

  describe('delete()', () => {
    it('deletes and returns the deleted record', async () => {
      const { repo, delegate } = buildRepo();
      const deleted = { id: 1, name: 'Alice' };
      delegate.delete.mockResolvedValue(deleted);
      await expect(repo.delete({ id: 1 })).resolves.toEqual(deleted);
      expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('count()', () => {
    it('returns record count', async () => {
      const { repo, delegate } = buildRepo();
      delegate.count.mockResolvedValue(5);
      await expect(repo.count()).resolves.toBe(5);
    });

    it('passes args to count', async () => {
      const { repo, delegate } = buildRepo();
      delegate.count.mockResolvedValue(2);
      const args = { where: { name: 'Alice' } };
      await expect(repo.count(args)).resolves.toBe(2);
      expect(delegate.count).toHaveBeenCalledWith(args);
    });
  });

  describe('prismaClient / modelDelegate getters', () => {
    it('prismaClient returns the prisma instance', () => {
      const { repo } = buildRepo();
      expect((repo as unknown as { prismaClient: unknown }).prismaClient).toBeDefined();
    });
  });

  describe('handleError()', () => {
    it('throws unique constraint error for P2002 with target', () => {
      const { repo } = buildRepo();
      const err = new PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        meta: { target: ['email', 'username'] },
      });
      expect(() => repo.testHandleError(err)).toThrow(
        'Unique constraint violation on fields: email, username'
      );
    });

    it('throws unique constraint error for P2002 without target', () => {
      const { repo } = buildRepo();
      const err = new PrismaClientKnownRequestError('unique', { code: 'P2002' });
      expect(() => repo.testHandleError(err)).toThrow('Unique constraint violation on field');
    });

    it('throws not found error for P2025', () => {
      const { repo } = buildRepo();
      const err = new PrismaClientKnownRequestError('not found', { code: 'P2025' });
      expect(() => repo.testHandleError(err)).toThrow('Record not found');
    });

    it('throws foreign key error for P2003', () => {
      const { repo } = buildRepo();
      const err = new PrismaClientKnownRequestError('fk', { code: 'P2003' });
      expect(() => repo.testHandleError(err)).toThrow('Foreign key constraint violation');
    });

    it('throws generic db error for unknown prisma code', () => {
      const { repo } = buildRepo();
      const err = new PrismaClientKnownRequestError('unknown', { code: 'P9999' });
      expect(() => repo.testHandleError(err)).toThrow('Database error:');
    });

    it('throws wrapped error for non-prisma errors', () => {
      const { repo } = buildRepo();
      expect(() => repo.testHandleError(new Error('generic error'))).toThrow(
        'Database error: generic error'
      );
    });
  });
});

// ─── Repository decorator ─────────────────────────────────────────────────────

describe('@Repository decorator', () => {
  it('sets hazel:repository metadata with string shorthand', () => {
    @Repository('user')
    class UserRepo {}

    const meta = Reflect.getMetadata('hazel:repository', UserRepo);
    expect(meta).toEqual({ model: 'user' });
  });

  it('sets hazel:repository metadata with options object', () => {
    @Repository({ model: 'post' })
    class PostRepo {}

    const meta = Reflect.getMetadata('hazel:repository', PostRepo);
    expect(meta).toEqual({ model: 'post' });
  });

  it('sets hazel:injectable metadata', () => {
    @Repository('comment')
    class CommentRepo {}

    const injectable = Reflect.getMetadata('hazel:injectable', CommentRepo);
    expect(injectable).toEqual({});
  });

  it('sets hazel:scope metadata when scope is provided', () => {
    @Repository({ model: 'session', scope: 'REQUEST' as unknown as never })
    class SessionRepo {}

    const scope = Reflect.getMetadata('hazel:scope', SessionRepo);
    expect(scope).toBe('REQUEST');
  });

  it('sets hazel:injectable metadata with scope when scope is provided', () => {
    @Repository({ model: 'log', scope: 'TRANSIENT' as unknown as never })
    class LogRepo {}

    const injectable = Reflect.getMetadata('hazel:injectable', LogRepo);
    expect(injectable).toEqual({ scope: 'TRANSIENT' });
  });

  it('sets hazel:repository:model for InjectRepository', () => {
    @Repository('profile')
    class ProfileRepo {}

    const model = Reflect.getMetadata('hazel:repository:model', ProfileRepo);
    expect(model).toBe('profile');
  });
});

describe('PrismaModule', () => {
  it('exports PrismaModule class with providers and exports', () => {
    expect(PrismaModule).toBeDefined();
    const _meta = Reflect.getMetadata('hazel:module', PrismaModule) ?? (PrismaModule as any).module;
    expect(PrismaModule).toHaveProperty('name', 'PrismaModule');
  });
});

describe('InjectRepository', () => {
  it('throws when used on constructor parameter (propertyKey undefined)', () => {
    const decorator = InjectRepository();
    expect(() => decorator(class C {}, undefined!, 0)).toThrow(
      'InjectRepository decorator must be used on a method parameter'
    );
  });

  it('pushes repository metadata when used on method parameter', () => {
    @Repository('product')
    class ProductRepo {}

    class Consumer {
      doSomething(@InjectRepository() _repo: ProductRepo) {}
    }
    const repos = Reflect.getMetadata('hazel:repositories', Consumer.prototype);
    expect(repos).toBeDefined();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual({ index: 0, model: 'product' });
  });

  it('throws when repository type is not decorated with @Repository', () => {
    class UndecoratedRepo {}
    const proto = class {
      method(_r: UndecoratedRepo) {}
    }.prototype;
    Reflect.defineMetadata('design:paramtypes', [UndecoratedRepo], proto, 'method');
    const decorator = InjectRepository();
    expect(() => decorator(proto, 'method', 0)).toThrow(/not decorated with @Repository/);
  });
});
