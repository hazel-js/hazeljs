import { Injectable } from '@hazeljs/core';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: number;
  email: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET || 'your-secret-key';

  async signAsync(payload: JwtPayload): Promise<string> {
    return jwt.sign(payload, this.secret);
  }

  async verifyAsync(token: string): Promise<JwtPayload> {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token payload');
    }
    return decoded as unknown as JwtPayload;
  }
}
