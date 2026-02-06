import { Injectable } from '@hazeljs/core';
import { JwtService, JwtPayload } from './jwt/jwt.service';

export interface AuthUser {
  id: string;
  username?: string;
  role: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload: JwtPayload = this.jwtService.verify(token);
      return {
        id: payload.sub,
        username: (payload.username as string) || (payload.email as string),
        role: (payload.role as string) || 'user',
        ...payload,
      };
    } catch {
      return null;
    }
  }
}
