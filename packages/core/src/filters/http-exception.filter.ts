import { ExceptionFilter, ArgumentsHost, Catch } from './exception-filter';
import { HttpError } from '../errors/http.error';
import logger from '../logger';

/**
 * Built-in HTTP exception filter
 */
@Catch(HttpError)
export class HttpExceptionFilter implements ExceptionFilter<HttpError> {
  catch(exception: HttpError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.statusCode || 500;
    const message = exception.message || 'Internal server error';

    logger.error(`[${request.method}] ${request.url} - ${message} (${status})`);

    if (process.env.NODE_ENV === 'development' && exception.stack) {
      logger.debug(exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(exception.errors && { errors: exception.errors }),
    });
  }
}
