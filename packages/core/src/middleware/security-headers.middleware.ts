import { Request, Response } from '../types';
import { MiddlewareClass, NextFunction } from './global-middleware';

/**
 * Security headers configuration
 */
export interface SecurityHeadersOptions {
  /**
   * Enable X-Content-Type-Options header
   * Prevents MIME type sniffing
   */
  noSniff?: boolean;

  /**
   * Enable X-Frame-Options header
   * Prevents clickjacking attacks
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;

  /**
   * Enable X-XSS-Protection header
   * Enables browser XSS filter
   */
  xssProtection?: boolean;

  /**
   * Enable Strict-Transport-Security (HSTS) header
   * Forces HTTPS connections
   */
  hsts?: {
    maxAge?: number; // in seconds, default: 31536000 (1 year)
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  /**
   * Enable Content-Security-Policy header
   * Controls resource loading
   */
  contentSecurityPolicy?: string | {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    fontSrc?: string[];
    objectSrc?: string[];
    mediaSrc?: string[];
    frameSrc?: string[];
    baseUri?: string[];
    formAction?: string[];
    frameAncestors?: string[];
    upgradeInsecureRequests?: boolean;
  };

  /**
   * Enable Referrer-Policy header
   * Controls referrer information
   */
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';

  /**
   * Enable Permissions-Policy header
   * Controls browser features
   */
  permissionsPolicy?: Record<string, string[]>;

  /**
   * Enable X-Powered-By removal
   * Hides framework information
   */
  hidePoweredBy?: boolean;
}

/**
 * Security Headers Middleware
 * Adds security headers to HTTP responses
 */
export class SecurityHeadersMiddleware implements MiddlewareClass {
  constructor(private options: SecurityHeadersOptions = {}) {
    // Set secure defaults
    this.options = {
      noSniff: true,
      frameOptions: 'DENY',
      xssProtection: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: false,
      },
      hidePoweredBy: true,
      ...options,
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Remove X-Powered-By header
    if (this.options.hidePoweredBy) {
      res.setHeader('X-Powered-By', '');
    }

    // X-Content-Type-Options
    if (this.options.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (this.options.frameOptions) {
      res.setHeader('X-Frame-Options', this.options.frameOptions);
    }

    // X-XSS-Protection
    if (this.options.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Strict-Transport-Security
    if (this.options.hsts && (req.headers?.['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production')) {
      const hstsValue = [
        `max-age=${this.options.hsts.maxAge || 31536000}`,
        this.options.hsts.includeSubDomains ? 'includeSubDomains' : '',
        this.options.hsts.preload ? 'preload' : '',
      ]
        .filter(Boolean)
        .join('; ');

      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Content-Security-Policy
    if (this.options.contentSecurityPolicy) {
      const csp = typeof this.options.contentSecurityPolicy === 'string'
        ? this.options.contentSecurityPolicy
        : this.buildCSP(this.options.contentSecurityPolicy);

      res.setHeader('Content-Security-Policy', csp);
    }

    // Referrer-Policy
    if (this.options.referrerPolicy) {
      res.setHeader('Referrer-Policy', this.options.referrerPolicy);
    }

    // Permissions-Policy
    if (this.options.permissionsPolicy) {
      const permissions = Object.entries(this.options.permissionsPolicy)
        .map(([feature, allowlist]) => {
          const value = allowlist.length === 0 ? '()' : `(${allowlist.join(' ')})`;
          return `${feature}=${value}`;
        })
        .join(', ');

      res.setHeader('Permissions-Policy', permissions);
    }

    next();
  }

  private buildCSP(policy: NonNullable<SecurityHeadersOptions['contentSecurityPolicy']>): string {
    if (typeof policy === 'string') {
      return policy;
    }

    const directives: string[] = [];

    if (policy.defaultSrc) {
      directives.push(`default-src ${policy.defaultSrc.join(' ')}`);
    }
    if (policy.scriptSrc) {
      directives.push(`script-src ${policy.scriptSrc.join(' ')}`);
    }
    if (policy.styleSrc) {
      directives.push(`style-src ${policy.styleSrc.join(' ')}`);
    }
    if (policy.imgSrc) {
      directives.push(`img-src ${policy.imgSrc.join(' ')}`);
    }
    if (policy.connectSrc) {
      directives.push(`connect-src ${policy.connectSrc.join(' ')}`);
    }
    if (policy.fontSrc) {
      directives.push(`font-src ${policy.fontSrc.join(' ')}`);
    }
    if (policy.objectSrc) {
      directives.push(`object-src ${policy.objectSrc.join(' ')}`);
    }
    if (policy.mediaSrc) {
      directives.push(`media-src ${policy.mediaSrc.join(' ')}`);
    }
    if (policy.frameSrc) {
      directives.push(`frame-src ${policy.frameSrc.join(' ')}`);
    }
    if (policy.baseUri) {
      directives.push(`base-uri ${policy.baseUri.join(' ')}`);
    }
    if (policy.formAction) {
      directives.push(`form-action ${policy.formAction.join(' ')}`);
    }
    if (policy.frameAncestors) {
      directives.push(`frame-ancestors ${policy.frameAncestors.join(' ')}`);
    }
    if (policy.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }

    return directives.join('; ');
  }
}

