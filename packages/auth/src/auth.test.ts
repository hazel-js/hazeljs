/// <reference types="jest" />

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  Injectable: () => () => undefined,
  HazelModule: () => () => undefined,
  RequestContext: class {},
  Container: {
    getInstance: jest.fn(),
  },
  Type: class {},
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Container } from '@hazeljs/core';
import { JwtService } from './jwt/jwt.service';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { Auth } from './auth.guard';
import { JwtModule } from './jwt/jwt.module';

const TEST_SECRET = 'test-secret-key-for-unit-tests';

describe('JwtService', () => {
  beforeEach(() => {
    JwtService.configure({ secret: TEST_SECRET, expiresIn: '1h' });
  });

  afterEach(() => {
    JwtService.configure({});
  });

  it('throws if no secret is configured', () => {
    JwtService.configure({});
    delete process.env.JWT_SECRET;
    expect(() => new JwtService()).toThrow('JWT secret is not configured');
  });

  it('uses JWT_SECRET env var when no configure() secret', () => {
    JwtService.configure({});
    process.env.JWT_SECRET = 'env-secret';
    expect(() => new JwtService()).not.toThrow();
    delete process.env.JWT_SECRET;
  });

  it('signs and verifies a payload', () => {
    const svc = new JwtService();
    const token = svc.sign({ sub: 'user-1', role: 'admin' });
    expect(typeof token).toBe('string');

    const payload = svc.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('admin');
  });

  it('sign accepts a custom expiresIn', () => {
    const svc = new JwtService();
    const token = svc.sign({ sub: 'user-2' }, { expiresIn: '2h' });
    const payload = svc.verify(token);
    expect(payload.sub).toBe('user-2');
  });

  it('decode returns payload without verification', () => {
    const svc = new JwtService();
    const token = svc.sign({ sub: 'user-3', data: 'test' });
    const decoded = svc.decode(token);
    expect(decoded?.sub).toBe('user-3');
    expect(decoded?.data).toBe('test');
  });

  it('decode returns null for invalid token string', () => {
    const svc = new JwtService();
    const decoded = svc.decode('not-a-jwt');
    expect(decoded).toBeNull();
  });

  it('verify throws for invalid token', () => {
    const svc = new JwtService();
    expect(() => svc.verify('bad-token')).toThrow();
  });

  it('verify throws for token signed with different secret', () => {
    JwtService.configure({ secret: 'other-secret' });
    const other = new JwtService();
    const token = other.sign({ sub: 'x' });

    JwtService.configure({ secret: TEST_SECRET });
    const svc = new JwtService();
    expect(() => svc.verify(token)).toThrow();
  });

  it('configure() sets module options used by constructor', () => {
    JwtService.configure({
      secret: 'configured-secret',
      expiresIn: '30m',
      issuer: 'hazel',
      audience: 'app',
    });
    const svc = new JwtService();
    const token = svc.sign({ sub: 'u' });
    expect(typeof token).toBe('string');
  });

  it('uses JWT_EXPIRES_IN env var', () => {
    JwtService.configure({ secret: TEST_SECRET });
    process.env.JWT_EXPIRES_IN = '2h';
    const svc = new JwtService();
    const token = svc.sign({ sub: 'u' });
    expect(typeof token).toBe('string');
    delete process.env.JWT_EXPIRES_IN;
  });

  it('uses JWT_ISSUER and JWT_AUDIENCE env vars', () => {
    JwtService.configure({ secret: TEST_SECRET });
    process.env.JWT_ISSUER = 'my-issuer';
    process.env.JWT_AUDIENCE = 'my-audience';
    const svc = new JwtService();
    const token = svc.sign({ sub: 'u' });
    expect(typeof token).toBe('string');
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });
});

describe('AuthService', () => {
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    JwtService.configure({ secret: TEST_SECRET });
    jwtService = new JwtService();
    authService = new AuthService(jwtService);
  });

  afterEach(() => {
    JwtService.configure({});
  });

  it('verifyToken returns user for valid token', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: 'admin', username: 'alice' });
    const user = await authService.verifyToken(token);
    expect(user).not.toBeNull();
    expect(user?.id).toBe('user-1');
    expect(user?.role).toBe('admin');
    expect(user?.username).toBe('alice');
  });

  it('verifyToken returns user with email as username fallback', async () => {
    const token = jwtService.sign({ sub: 'user-2', email: 'bob@example.com' });
    const user = await authService.verifyToken(token);
    expect(user?.username).toBe('bob@example.com');
  });

  it('verifyToken defaults role to "user" when not in payload', async () => {
    const token = jwtService.sign({ sub: 'user-3' });
    const user = await authService.verifyToken(token);
    expect(user?.role).toBe('user');
  });

  it('verifyToken returns null for invalid token', async () => {
    const user = await authService.verifyToken('invalid-token');
    expect(user).toBeNull();
  });

  it('verifyToken returns null when jwtService.verify throws', async () => {
    const mockJwt = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      }),
    } as unknown as JwtService;
    const svc = new AuthService(mockJwt);
    const user = await svc.verifyToken('any-token');
    expect(user).toBeNull();
  });
});

describe('AuthGuard', () => {
  let jwtService: JwtService;
  let authService: AuthService;
  let guard: AuthGuard;

  function makeContext(overrides: Record<string, unknown> = {}): {
    headers: Record<string, string>;
    method: string;
    url: string;
    user?: unknown;
  } {
    return {
      headers: {},
      method: 'GET',
      url: '/test',
      ...overrides,
    };
  }

  beforeEach(() => {
    JwtService.configure({ secret: TEST_SECRET });
    jwtService = new JwtService();
    authService = new AuthService(jwtService);
    guard = new AuthGuard(authService);
  });

  afterEach(() => {
    JwtService.configure({});
  });

  it('throws 400 when no authorization header', async () => {
    const ctx = makeContext() as never;
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'No authorization header',
      status: 400,
    });
  });

  it('throws 400 when authorization header has no token part', async () => {
    const ctx = makeContext({ headers: { authorization: 'Bearer' } }) as never;
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      message: 'Invalid authorization header format',
      status: 400,
    });
  });

  it('throws 401 when token is invalid', async () => {
    const ctx = makeContext({ headers: { authorization: 'Bearer badtoken' } }) as never;
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 401 });
  });

  it('returns true and attaches user for valid token', async () => {
    const token = jwtService.sign({ sub: 'u1', role: 'user' });
    const ctx = makeContext({ headers: { authorization: `Bearer ${token}` } }) as never;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((ctx as { user?: unknown }).user).toBeDefined();
  });

  it('throws 403 when user role is not in required roles', async () => {
    const token = jwtService.sign({ sub: 'u2', role: 'user' });
    const ctx = makeContext({ headers: { authorization: `Bearer ${token}` } }) as never;
    await expect(guard.canActivate(ctx, { roles: ['admin'] })).rejects.toMatchObject({
      message: 'Insufficient permissions',
      status: 403,
    });
  });

  it('returns true when user role matches required roles', async () => {
    const token = jwtService.sign({ sub: 'u3', role: 'admin' });
    const ctx = makeContext({ headers: { authorization: `Bearer ${token}` } }) as never;
    const result = await guard.canActivate(ctx, { roles: ['admin', 'superadmin'] });
    expect(result).toBe(true);
  });

  it('logs stack trace in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const ctx = makeContext({ headers: { authorization: 'Bearer bad' } }) as never;
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
    process.env.NODE_ENV = originalEnv;
  });
});

describe('Auth decorator', () => {
  let jwtService: JwtService;
  let authService: AuthService;
  let guard: AuthGuard;

  beforeEach(() => {
    JwtService.configure({ secret: TEST_SECRET });
    jwtService = new JwtService();
    authService = new AuthService(jwtService);
    guard = new AuthGuard(authService);
  });

  afterEach(() => {
    JwtService.configure({});
  });

  it('calls the original method when auth passes', async () => {
    (Container.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(guard),
    });

    const token = jwtService.sign({ sub: 'u1', role: 'user' });

    class TestController {
      @Auth()
      async getResource(_context: unknown): Promise<string> {
        return 'ok';
      }
    }

    const ctrl = new TestController();
    const ctx = {
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/test',
    };

    const result = await ctrl.getResource(ctx as never);
    expect(result).toBe('ok');
  });

  it('throws when guard is not found in container', async () => {
    (Container.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(null),
    });

    class TestController {
      @Auth()
      async getResource(_context: unknown): Promise<string> {
        return 'ok';
      }
    }

    const ctrl = new TestController();
    const ctx = {
      headers: { authorization: 'Bearer sometoken' },
      method: 'GET',
      url: '/test',
    };

    await expect(ctrl.getResource(ctx as never)).rejects.toThrow('AuthGuard not found');
  });

  it('propagates auth errors from guard', async () => {
    (Container.getInstance as jest.Mock).mockReturnValue({
      resolve: jest.fn().mockReturnValue(guard),
    });

    class TestController {
      @Auth({ roles: ['admin'] })
      async adminOnly(_context: unknown): Promise<string> {
        return 'admin';
      }
    }

    const ctrl = new TestController();
    const token = jwtService.sign({ sub: 'u2', role: 'user' });
    const ctx = {
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/admin',
    };

    await expect(ctrl.adminOnly(ctx as never)).rejects.toMatchObject({
      message: 'Insufficient permissions',
    });
  });
});

describe('JwtModule', () => {
  it('forRoot returns JwtModule', () => {
    const result = JwtModule.forRoot({ secret: TEST_SECRET });
    expect(result).toBe(JwtModule);
  });

  it('forRoot without options returns JwtModule', () => {
    JwtService.configure({ secret: TEST_SECRET });
    const result = JwtModule.forRoot();
    expect(result).toBe(JwtModule);
  });
});
