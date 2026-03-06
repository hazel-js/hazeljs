/// <reference types="jest" />

import 'reflect-metadata';

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  Injectable: () => () => undefined,
  HazelModule: () => () => undefined,
  Container: {
    getInstance: jest.fn(),
  },
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Container } from '@hazeljs/core';
import { MongoAbility, createMongoAbility, AbilityBuilder, subject } from '@casl/ability';

import { AbilityFactory } from './ability.factory';
import { CaslService } from './casl.service';
import { CaslModule } from './casl.module';
import { PoliciesGuard } from './policy.guard';
import { CheckPolicies } from './decorators/check-policies.decorator';
import { Ability } from './decorators/ability.decorator';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subject = { kind: 'Post'; authorId: string } | 'Post' | 'all';
type AppAbility = MongoAbility<[Action, Subject]>;

function buildAbility(role: 'admin' | 'user', userId: string): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (role === 'admin') {
    can('manage', 'all');
  } else {
    can('read', 'Post');
    can('update', 'Post', { authorId: userId } as Record<string, unknown>);
    cannot('delete', 'Post');
  }
  return build();
}

class TestAbilityFactory extends AbilityFactory<AppAbility> {
  createForUser(user: Record<string, unknown>): AppAbility {
    return buildAbility(user['role'] as 'admin' | 'user', user['id'] as string);
  }
}

// ---------------------------------------------------------------------------
// Helper: build a mock ExecutionContext
// ---------------------------------------------------------------------------
function makeCtx(user: Record<string, unknown> | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getContext: () => ({}),
    }),
  };
}

// ---------------------------------------------------------------------------
// CaslService
// ---------------------------------------------------------------------------

describe('CaslService', () => {
  const mockContainer = Container as jest.Mocked<typeof Container>;

  beforeEach(() => {
    CaslService.factoryClass = undefined;
    jest.clearAllMocks();
  });

  it('throws when no factory is configured', () => {
    const svc = new CaslService();
    expect(() => svc.createForUser({ id: '1', role: 'user' })).toThrow(
      'CaslService: no AbilityFactory registered'
    );
  });

  it('resolves the factory from the DI container and calls createForUser', () => {
    const factory = new TestAbilityFactory();
    (mockContainer.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(factory),
    });

    CaslService.configure(TestAbilityFactory);
    const svc = new CaslService();

    const user = { id: 'user-1', role: 'admin' };
    const ability = svc.createForUser(user);

    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('returns an ability respecting conditions for regular users', () => {
    const factory = new TestAbilityFactory();
    (mockContainer.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(factory),
    });

    CaslService.configure(TestAbilityFactory);
    const svc = new CaslService();

    const user = { id: 'user-1', role: 'user' };
    const ability = svc.createForUser(user);

    expect(ability.can('read', 'Post')).toBe(true);
    expect(ability.can('delete', 'Post')).toBe(false);
    // own post — use subject() helper so CASL knows the subject type
    expect(ability.can('update', subject('Post', { authorId: 'user-1' }))).toBe(true);
    // someone else's post
    expect(ability.can('update', subject('Post', { authorId: 'other-user' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CaslModule.forRoot
// ---------------------------------------------------------------------------

describe('CaslModule.forRoot', () => {
  afterEach(() => {
    CaslService.factoryClass = undefined;
  });

  it('configures the factory class on CaslService', () => {
    CaslModule.forRoot({ abilityFactory: TestAbilityFactory });
    expect(CaslService.factoryClass).toBe(TestAbilityFactory);
  });

  it('returns the CaslModule class (for HazelModule imports)', () => {
    const result = CaslModule.forRoot({ abilityFactory: TestAbilityFactory });
    expect(result).toBe(CaslModule);
  });
});

// ---------------------------------------------------------------------------
// PoliciesGuard
// ---------------------------------------------------------------------------

describe('PoliciesGuard', () => {
  const mockContainer = Container as jest.Mocked<typeof Container>;

  beforeEach(() => {
    CaslService.factoryClass = undefined;
    jest.clearAllMocks();
  });

  function setupFactory() {
    const factory = new TestAbilityFactory();
    (mockContainer.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(factory),
    });
    CaslService.configure(TestAbilityFactory);
    return new CaslService<AppAbility>();
  }

  it('returns true when no handlers are provided', async () => {
    const casl = setupFactory();
    const Guard = PoliciesGuard();
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx({ id: '1', role: 'user' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns true when all function handlers pass', async () => {
    const casl = setupFactory();
    const Guard = PoliciesGuard<AppAbility>((ability) => ability.can('read', 'Post'));
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx({ id: '1', role: 'user' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws 403 when a handler returns false', async () => {
    const casl = setupFactory();
    const Guard = PoliciesGuard<AppAbility>((ability) => ability.can('delete', 'Post'));
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx({ id: '1', role: 'user' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 403 });
  });

  it('throws 401 when req.user is missing', async () => {
    const casl = setupFactory();
    const Guard = PoliciesGuard<AppAbility>((ability) => ability.can('read', 'Post'));
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx(undefined);

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 401 });
  });

  it('works with a class-instance (IPolicyHandler) handler', async () => {
    const casl = setupFactory();

    const classHandler = {
      handle: jest.fn().mockResolvedValue(true),
    };

    const Guard = PoliciesGuard<AppAbility>(classHandler);
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx({ id: '1', role: 'user' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(classHandler.handle).toHaveBeenCalledTimes(1);
  });

  it('admin passes all checks', async () => {
    const casl = setupFactory();
    const Guard = PoliciesGuard<AppAbility>(
      (ability) => ability.can('read', 'Post'),
      (ability) => ability.can('delete', 'Post'),
      (ability) => ability.can('create', 'Post')
    );
    const guard = new (Guard as new (svc: CaslService<AppAbility>) => {
      canActivate: (ctx: unknown) => Promise<boolean>;
    })(casl);
    const ctx = makeCtx({ id: 'admin-1', role: 'admin' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// @CheckPolicies decorator
// ---------------------------------------------------------------------------

describe('@CheckPolicies decorator', () => {
  it('registers a PoliciesGuard on the method metadata under hazel:guards', () => {
    class TestController {
      @CheckPolicies<AppAbility>((ability) => ability.can('read', 'Post'))
      getAll() {
        return [];
      }
    }

    const guards: unknown[] = Reflect.getMetadata(
      'hazel:guards',
      TestController.prototype,
      'getAll'
    );

    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toHaveLength(1);
  });

  it('appends to existing guards without overwriting them', () => {
    // Pre-register a guard manually the way @UseGuards would
    class MockGuard {}
    class TestController {
      dummy() {}
    }
    Reflect.defineMetadata('hazel:guards', [MockGuard], TestController.prototype, 'dummy');

    // Now apply CheckPolicies
    const decorator = CheckPolicies<AppAbility>((ability) => ability.can('read', 'Post'));
    const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, 'dummy')!;
    decorator(TestController.prototype, 'dummy', descriptor);

    const guards: unknown[] = Reflect.getMetadata(
      'hazel:guards',
      TestController.prototype,
      'dummy'
    );

    expect(guards).toHaveLength(2);
    expect(guards[0]).toBe(MockGuard);
  });
});

// ---------------------------------------------------------------------------
// @Ability() decorator
// ---------------------------------------------------------------------------

describe('@Ability() decorator', () => {
  const INJECT_KEY = 'hazel:inject';

  it('stores a custom injection on the method metadata', () => {
    class TestController {
      getTask(@Ability() _ability: unknown) {
        return _ability;
      }
    }
    const injections: unknown[] = Reflect.getMetadata(INJECT_KEY, TestController, 'getTask');
    expect(Array.isArray(injections)).toBe(true);
    expect(injections).toHaveLength(1);
    const inj = injections[0] as { type: string; resolve: unknown };
    expect(inj.type).toBe('custom');
    expect(typeof inj.resolve).toBe('function');
  });

  it('resolve() calls CaslService.createForUser with context.user', () => {
    const mockAbility = { can: jest.fn() };
    const mockCaslSvc = { createForUser: jest.fn().mockReturnValue(mockAbility) };
    const mockContainer = { resolve: jest.fn().mockReturnValue(mockCaslSvc) };

    class TestController {
      getTask(@Ability() _ability: unknown) {
        return _ability;
      }
    }

    const injections = Reflect.getMetadata(INJECT_KEY, TestController, 'getTask') as Array<{
      type: string;
      resolve: (req: unknown, ctx: unknown, container: unknown) => unknown;
    }>;

    const context = { user: { sub: 'u1', role: 'admin' } };
    const result = injections[0].resolve(null, context, mockContainer);

    expect(mockContainer.resolve).toHaveBeenCalledWith(CaslService);
    expect(mockCaslSvc.createForUser).toHaveBeenCalledWith({ sub: 'u1', role: 'admin' });
    expect(result).toBe(mockAbility);
  });

  it('resolve() falls back to empty user object when context.user is undefined', () => {
    const mockCaslSvc = { createForUser: jest.fn().mockReturnValue({}) };
    const mockContainer = { resolve: jest.fn().mockReturnValue(mockCaslSvc) };

    class TestController {
      getTask(@Ability() _ability: unknown) {
        return _ability;
      }
    }

    const injections = Reflect.getMetadata(INJECT_KEY, TestController, 'getTask') as Array<{
      type: string;
      resolve: (req: unknown, ctx: unknown, container: unknown) => unknown;
    }>;

    injections[0].resolve(null, {}, mockContainer);
    expect(mockCaslSvc.createForUser).toHaveBeenCalledWith({});
  });

  it('throws when used outside a method parameter', () => {
    expect(() => {
      const decorator = Ability();
      decorator({}, undefined, 0);
    }).toThrow('@Ability() must be used on a method parameter');
  });

  it('does not overwrite existing injections at other parameter indices', () => {
    class TestController {
      getTask(@Ability() _ability: unknown, _id: string) {
        return _ability;
      }
    }
    // Only index 0 should be set; index 1 is unset
    const injections: unknown[] = Reflect.getMetadata(INJECT_KEY, TestController, 'getTask');
    expect(injections[0]).toBeDefined();
    expect(injections[1]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AbilityFactory abstract class
// ---------------------------------------------------------------------------

describe('AbilityFactory', () => {
  it('can be extended and createForUser can be implemented', () => {
    const factory = new TestAbilityFactory();
    const ability = factory.createForUser({ id: 'u1', role: 'admin' });
    expect(ability.can('manage', 'all')).toBe(true);
  });
});
