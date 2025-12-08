import { Request, Response } from '../types';
import { MiddlewareClass, NextFunction } from './global-middleware';
import { HttpError } from '../errors/http.error';
import { randomBytes, createHmac } from 'crypto';
import logger from '../logger';

/**
 * CSRF protection options
 */
export interface CsrfOptions {
  /**
   * Cookie name for CSRF token
   */
  cookieName?: string;

  /**
   * Header name for CSRF token
   */
  headerName?: string;

  /**
   * Secret key for token generation
   */
  secret?: string;

  /**
   * Cookie options
   */
  cookieOptions?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    domain?: string;
    maxAge?: number;
  };

  /**
   * Methods to protect (default: POST, PUT, PATCH, DELETE)
   */
  methods?: string[];

  /**
   * Paths to exclude from CSRF protection
   */
  excludePaths?: string[];

  /**
   * Token length in bytes
   */
  tokenLength?: number;
}

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */
export class CsrfMiddleware implements MiddlewareClass {
  private secret: string;
  private tokenStore: Map<string, string> = new Map();

  constructor(private options: CsrfOptions = {}) {
    this.options = {
      cookieName: '_csrf',
      headerName: 'x-csrf-token',
      secret: process.env.CSRF_SECRET || randomBytes(32).toString('hex'),
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 3600, // 1 hour
      },
      methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
      tokenLength: 32,
      ...options,
    };

    this.secret = this.options.secret!;

    // Cleanup expired tokens every 5 minutes
    setInterval(() => {
      this.cleanupTokens();
    }, 300000);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.url?.split('?')[0] || '/';

    // Skip excluded paths
    if (this.options.excludePaths?.some(excluded => path.startsWith(excluded))) {
      next();
      return;
    }

    // Generate or retrieve token
    const token = this.getOrCreateToken(req, res);

    // Check if method requires CSRF protection
    if (this.options.methods?.includes(req.method || '')) {
      const providedToken = this.getTokenFromRequest(req);

      if (!providedToken || !this.verifyToken(token, providedToken)) {
        logger.warn(`CSRF token validation failed for ${req.method} ${path}`);
        throw new HttpError(403, 'Invalid CSRF token');
      }
    }

    // Add token to response for forms
    res.setHeader('X-CSRF-Token', token);

    next();
  }

  /**
   * Get or create CSRF token
   */
  private getOrCreateToken(req: Request, res: Response): string {
    const sessionId = this.getSessionId(req);
    let token = this.tokenStore.get(sessionId);

    if (!token) {
      token = this.generateToken();
      this.tokenStore.set(sessionId, token);
    }

    // Set cookie
    const cookie = this.buildCookie(token);
    res.setHeader('Set-Cookie', cookie);

    return token;
  }

  /**
   * Generate CSRF token
   */
  private generateToken(): string {
    const random = randomBytes(this.options.tokenLength || 32).toString('hex');
    const hmac = createHmac('sha256', this.secret);
    hmac.update(random);
    const signature = hmac.digest('hex');
    return `${random}.${signature}`;
  }

  /**
   * Verify CSRF token
   */
  private verifyToken(storedToken: string, providedToken: string): boolean {
    if (!storedToken || !providedToken) return false;
    if (storedToken === providedToken) return true;

    // Verify signature
    const [random, signature] = providedToken.split('.');
    if (!random || !signature) return false;

    const hmac = createHmac('sha256', this.secret);
    hmac.update(random);
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Get token from request
   */
  private getTokenFromRequest(req: Request): string | null {
    // Try header first
    if (req.headers) {
      const headerToken = req.headers[this.options.headerName!.toLowerCase()];
      if (headerToken) {
        return Array.isArray(headerToken) ? headerToken[0] : headerToken;
      }
    }

    // Try body
    if (req.body && typeof req.body === 'object' && this.options.cookieName! in req.body) {
      const bodyValue = (req.body as Record<string, unknown>)[this.options.cookieName!];
      return typeof bodyValue === 'string' ? bodyValue : null;
    }

    // Try query parameter
    if (req.query && typeof req.query === 'object' && this.options.cookieName! in req.query) {
      const queryValue = req.query[this.options.cookieName!];
      return typeof queryValue === 'string' ? queryValue : null;
    }

    return null;
  }

  /**
   * Get session ID from request
   */
  private getSessionId(req: Request): string {
    // Try to get from cookie
    if (req.headers?.cookie) {
      const sessionCookie = req.headers.cookie
        .split(';')
        .find(c => c.trim().startsWith('sessionId='));
      if (sessionCookie) {
        return sessionCookie.split('=')[1].trim();
      }
    }

    // Fallback to IP + User-Agent hash
    const ip = (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress || 'unknown';
    const ua = req.headers?.['user-agent'] || 'unknown';
    const hash = createHmac('sha256', this.secret)
      .update(`${ip}:${ua}`)
      .digest('hex')
      .substring(0, 16);

    return hash;
  }

  /**
   * Build cookie string
   */
  private buildCookie(token: string): string {
    const opts = this.options.cookieOptions!;
    const parts: string[] = [`${this.options.cookieName}=${token}`];

    if (opts.path) parts.push(`Path=${opts.path}`);
    if (opts.domain) parts.push(`Domain=${opts.domain}`);
    if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.httpOnly) parts.push('HttpOnly');
    if (opts.secure) parts.push('Secure');
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);

    return parts.join('; ');
  }

  /**
   * Cleanup expired tokens
   */
  private cleanupTokens(): void {
    // Simple cleanup - remove old entries
    // In production, use a proper session store with TTL
    if (this.tokenStore.size > 10000) {
      const entries = Array.from(this.tokenStore.entries());
      this.tokenStore.clear();
      // Keep last 5000 entries
      entries.slice(-5000).forEach(([key, value]) => {
        this.tokenStore.set(key, value);
      });
    }
  }
}

