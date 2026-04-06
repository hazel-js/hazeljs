import { Service } from '@hazeljs/core';
import { JwtService, JwtPayload } from './jwt/jwt.service';

export interface AuthUser {
  id: string;
  username?: string;
  role: string;
  [key: string]: unknown;
}

export interface ExternalIdentityClaims {
  sub?: string;
  id?: string;
  userId?: string;
  externalId?: string;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  organizationId?: string;
  orgId?: string;
  [key: string]: unknown;
}

@Service()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload: JwtPayload = this.jwtService.verify(token);
      return this.normalizeIdentity(payload as ExternalIdentityClaims);
    } catch {
      return null;
    }
  }

  /**
   * Normalize claims from JWT/OAuth/SAML-derived identities into AuthUser.
   * Useful when callback handlers mint tokens from non-uniform upstream claims.
   */
  normalizeIdentity(claims: ExternalIdentityClaims): AuthUser {
    const id =
      claims.sub || claims.id || claims.userId || claims.externalId || claims.email || 'unknown';
    const tenantId =
      claims.tenantId || claims.tenant_id || claims.organizationId || claims.orgId || undefined;

    return {
      id,
      username: claims.username || claims.email || claims.name,
      role: claims.role || 'user',
      ...(tenantId ? { tenantId } : {}),
      ...claims,
    };
  }
}
