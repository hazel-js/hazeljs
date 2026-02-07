import { Injectable } from '@hazeljs/core';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

export interface JwtServiceOptions {
  secret?: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

@Injectable()
export class JwtService {
  private readonly secret: string;
  private readonly defaultExpiresIn: string | number;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor() {
    const options = JwtService.moduleOptions;
    this.secret = options.secret || process.env.JWT_SECRET || '';
    this.defaultExpiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '1h';
    this.issuer = options.issuer || process.env.JWT_ISSUER;
    this.audience = options.audience || process.env.JWT_AUDIENCE;

    if (!this.secret) {
      throw new Error(
        'JWT secret is not configured. Set JWT_SECRET environment variable or pass secret via JwtModule.forRoot({ secret: "..." })'
      );
    }
  }

  private static moduleOptions: JwtServiceOptions = {};

  static configure(options: JwtServiceOptions): void {
    JwtService.moduleOptions = options;
  }

  sign(payload: JwtPayload, options?: { expiresIn?: string | number }): string {
    const signOptions: jwt.SignOptions = {
      expiresIn: (options?.expiresIn || this.defaultExpiresIn) as jwt.SignOptions['expiresIn'],
    };
    if (this.issuer) signOptions.issuer = this.issuer;
    if (this.audience) signOptions.audience = this.audience;

    return jwt.sign(payload, this.secret, signOptions);
  }

  verify(token: string): JwtPayload {
    const verifyOptions: jwt.VerifyOptions = {};
    if (this.issuer) verifyOptions.issuer = this.issuer;
    if (this.audience) verifyOptions.audience = this.audience;

    return jwt.verify(token, this.secret, verifyOptions) as JwtPayload;
  }

  decode(token: string): JwtPayload | null {
    const decoded = jwt.decode(token);
    return decoded as JwtPayload | null;
  }
}
