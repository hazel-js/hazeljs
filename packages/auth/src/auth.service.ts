import { Injectable } from '@hazeljs/core';
import { JwtService } from './jwt/jwt.service';

interface User {
  id: number;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return {
        id: payload.sub,
        username: payload.email,
        role: 'user',
      };
    } catch {
      return null;
    }
  }
}
