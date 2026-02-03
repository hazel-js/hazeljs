/**
 * CORS Middleware
 * Handles Cross-Origin Resource Sharing
 */

import { Request, Response } from '../types';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export class CorsMiddleware {
  private options: Required<CorsOptions>;

  constructor(options: CorsOptions = {}) {
    this.options = {
      origin: options.origin || '*',
      methods: options.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowedHeaders: options.allowedHeaders || ['Content-Type', 'Authorization'],
      exposedHeaders: options.exposedHeaders || [],
      credentials: options.credentials || false,
      maxAge: options.maxAge || 86400, // 24 hours
      preflightContinue: options.preflightContinue || false,
      optionsSuccessStatus: options.optionsSuccessStatus || 204,
    };
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    const { origin: allowedOrigin } = this.options;

    if (allowedOrigin === '*') {
      return true;
    }

    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin);
    }

    if (typeof allowedOrigin === 'function') {
      return allowedOrigin(origin);
    }

    return false;
  }

  /**
   * Set CORS headers
   */
  private setCorsHeaders(req: Request, res: Response): void {
    const origin = (req.headers?.origin as string) || (req.headers?.referer as string) || '';

    // Set Access-Control-Allow-Origin
    if (this.options.origin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (this.isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    // Set Access-Control-Allow-Credentials
    if (this.options.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Set Access-Control-Expose-Headers
    if (this.options.exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', this.options.exposedHeaders.join(', '));
    }
  }

  /**
   * Handle preflight request
   */
  private handlePreflight(req: Request, res: Response): boolean {
    if (req.method !== 'OPTIONS') {
      return false;
    }

    // Set CORS headers
    this.setCorsHeaders(req, res);

    // Set Access-Control-Allow-Methods
    res.setHeader('Access-Control-Allow-Methods', this.options.methods.join(', '));

    // Set Access-Control-Allow-Headers
    const requestHeaders = req.headers?.['access-control-request-headers'] as string;
    if (requestHeaders) {
      res.setHeader('Access-Control-Allow-Headers', requestHeaders);
    } else if (this.options.allowedHeaders.length > 0) {
      res.setHeader('Access-Control-Allow-Headers', this.options.allowedHeaders.join(', '));
    }

    // Set Access-Control-Max-Age
    res.setHeader('Access-Control-Max-Age', this.options.maxAge.toString());

    // Send response
    if (!this.options.preflightContinue) {
      res.status(this.options.optionsSuccessStatus).end();
      return true;
    }

    return false;
  }

  /**
   * Handle CORS request
   */
  handle(req: Request, res: Response, next: () => void): void {
    // Handle preflight request
    if (this.handlePreflight(req, res)) {
      return;
    }

    // Set CORS headers for actual request
    this.setCorsHeaders(req, res);

    // Continue to next middleware
    next();
  }

  /**
   * Create middleware function
   */
  static create(options?: CorsOptions): (req: Request, res: Response, next: () => void) => void {
    const middleware = new CorsMiddleware(options);
    return (req, res, next) => middleware.handle(req, res, next);
  }
}

/**
 * Simple CORS helper for common use cases
 */
export function enableCors(options?: CorsOptions): (req: Request, res: Response, next: () => void) => void {
  return CorsMiddleware.create(options);
}
