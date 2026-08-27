/**
 * Integration test: JWT auth sign/verify flow across auth packages.
 */
import { JwtService, AuthService } from '@hazeljs/auth';

const TEST_SECRET = 'integration-test-secret-key';

describe('Auth integration', () => {
  beforeEach(() => {
    JwtService.configure({ secret: TEST_SECRET, expiresIn: '1h' });
  });

  afterEach(() => {
    JwtService.configure({});
  });

  it('signs and verifies tokens through JwtService', () => {
    const jwt = new JwtService();
    const token = jwt.sign({ sub: 'user-42', role: 'admin' });
    const payload = jwt.verify(token);

    expect(payload.sub).toBe('user-42');
    expect(payload.role).toBe('admin');
  });

  it('AuthService verifies tokens and normalizes identity claims', async () => {
    const jwt = new JwtService();
    const auth = new AuthService(jwt);

    const token = jwt.sign({ sub: 'user-99', email: 'dev@hazeljs.ai', role: 'editor' });
    const user = await auth.verifyToken(token);

    expect(user).not.toBeNull();
    expect(user!.id).toBe('user-99');
    expect(user!.role).toBe('editor');
    expect(user!.username).toBe('dev@hazeljs.ai');
  });

  it('AuthService normalizes external OAuth/SAML claims', () => {
    const auth = new AuthService(new JwtService());
    const user = auth.normalizeIdentity({
      externalId: 'oauth-123',
      email: 'user@example.com',
      tenant_id: 'org-1',
    });

    expect(user.id).toBe('oauth-123');
    expect(user.username).toBe('user@example.com');
    expect(user.tenantId).toBe('org-1');
  });
});
