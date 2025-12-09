/**
 * Request Timeout Middleware
 * Prevents requests from hanging indefinitely
 */

import { Request, Response } from '../types';
import logger from '../logger';

export interface TimeoutOptions {
  timeout?: number; // Timeout in milliseconds
  message?: string; // Custom timeout message
  onTimeout?: (req: Request) => void; // Callback when timeout occurs
}

export class TimeoutMiddleware {
  private timeout: number;
  private message: string;
  private onTimeout?: (req: Request) => void;

  constructor(options: TimeoutOptions = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.message = options.message || 'Request timeout';
    this.onTimeout = options.onTimeout;
  }

  /**
   * Create timeout handler for a request
   */
  handle(req: Request, res: Response, next: () => void): void {
    let timeoutId: NodeJS.Timeout | null = null;
    let timedOut = false;

    // Set timeout
    timeoutId = setTimeout(() => {
      timedOut = true;

      // Call custom timeout handler if provided
      if (this.onTimeout) {
        try {
          this.onTimeout(req);
        } catch (error) {
          logger.error('Error in timeout callback:', error);
        }
      }

      // Log timeout
      logger.warn('Request timeout:', {
        method: req.method,
        url: req.url,
        timeout: this.timeout,
      });

      // Send timeout response
      // Note: We can't check headersSent on our Response interface,
      // but the status/json methods will handle this internally
      res.status(408).json({
        statusCode: 408,
        message: this.message,
        error: 'Request Timeout',
      });
    }, this.timeout);

    // Clear timeout when response finishes
    // Store original end method
    const originalEnd = res.end.bind(res);
    res.end = function () {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return originalEnd();
    } as typeof res.end;

    // Continue to next middleware
    if (!timedOut) {
      next();
    }
  }

  /**
   * Create middleware function
   */
  static create(options?: TimeoutOptions): (req: Request, res: Response, next: () => void) => void {
    const middleware = new TimeoutMiddleware(options);
    return (req, res, next) => middleware.handle(req, res, next);
  }
}
