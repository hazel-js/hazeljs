import { RequestContext, Request } from './types';
import logger from './logger';
import { IncomingHttpHeaders } from 'http';

export class RequestParser {
  static async parseRequest(req: Request): Promise<RequestContext> {
    try {
      const { method, url, headers } = req;
      const context: RequestContext = {
        method: method || 'GET',
        url: url || '/',
        headers: this.normalizeHeaders(headers),
        params: { ...req.params },
        query: {},
        body: req.body || {},
      };

      // Parse query parameters
      if (url) {
        const queryString = url.split('?')[1];
        if (queryString) {
          context.query = this.parseQueryString(queryString);
        }
      }

      logger.debug('Parsed request context:', context);
      return context;
    } catch (error) {
      const err = error as { status?: number; message?: string; stack?: string };
      logger.error(
        `[${req.method}] ${req.url} - Request parsing error: ${err.message} (status: ${err.status || 400})`
      );
      if (process.env.NODE_ENV === 'development' && err.stack) {
        logger.debug(err.stack);
      }
      if (!err.status) {
        err.status = 500;
      }
      throw error;
    }
  }

  private static normalizeHeaders(
    headers: IncomingHttpHeaders | undefined
  ): Record<string, string> {
    const normalized: Record<string, string> = {};
    if (!headers) return normalized;
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value || '';
    }
    return normalized;
  }

  private static parseQueryString(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(queryString);
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    return params;
  }
}
