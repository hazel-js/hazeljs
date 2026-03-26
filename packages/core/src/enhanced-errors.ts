import { HttpError } from './errors/http.error';
import logger from './logger';

export interface ErrorSuggestion {
  message: string;
  code?: string;
  fix?: string;
  relatedDocs?: string;
}

export interface EnhancedError extends HttpError {
  suggestions: ErrorSuggestion[];
  context?: Record<string, unknown>;
  requestId?: string;
}

export class ErrorHandler {
  private static suggestionMap = new Map<string, ErrorSuggestion[]>();

  static {
    // Initialize common error suggestions
    this.initializeSuggestions();
  }

  private static initializeSuggestions(): void {
    // Validation errors
    this.suggestionMap.set('ValidationError', [
      {
        message: 'Check your request body format and required fields',
        code: 'VALIDATION_FAILED',
        fix: 'Ensure all required fields are present and correctly typed. Check the API documentation for expected format.',
        relatedDocs: '/docs/validation',
      },
    ]);

    // Authentication errors
    this.suggestionMap.set('UnauthorizedError', [
      {
        message: 'Authentication required or invalid credentials',
        code: 'AUTH_REQUIRED',
        fix: 'Provide a valid authentication token in the Authorization header.',
        relatedDocs: '/docs/authentication',
      },
    ]);

    // Not found errors
    this.suggestionMap.set('NotFoundError', [
      {
        message: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
        fix: 'Check the resource ID and ensure it exists. Verify the endpoint path is correct.',
        relatedDocs: '/docs/endpoints',
      },
    ]);

    // Method not allowed
    this.suggestionMap.set('MethodNotAllowedError', [
      {
        message: 'HTTP method not supported for this endpoint',
        code: 'METHOD_NOT_ALLOWED',
        fix: 'Check the allowed HTTP methods for this endpoint. Use GET for retrieving, POST for creating, PUT/PATCH for updating, DELETE for removing.',
        relatedDocs: '/docs/http-methods',
      },
    ]);

    // Rate limit errors
    this.suggestionMap.set('RateLimitError', [
      {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        fix: 'Wait before making another request. Implement exponential backoff in your client.',
        relatedDocs: '/docs/rate-limiting',
      },
    ]);

    // Timeout errors
    this.suggestionMap.set('TimeoutError', [
      {
        message: 'Request took too long to process',
        code: 'REQUEST_TIMEOUT',
        fix: 'Try again with a smaller payload or optimize your request. Consider implementing pagination.',
        relatedDocs: '/docs/optimization',
      },
    ]);

    // Database errors
    this.suggestionMap.set('DatabaseError', [
      {
        message: 'Database operation failed',
        code: 'DATABASE_ERROR',
        fix: 'Check database connection and retry. Contact support if the issue persists.',
        relatedDocs: '/docs/database',
      },
    ]);

    // Dependency injection errors
    this.suggestionMap.set('DependencyInjectionError', [
      {
        message: 'Dependency injection configuration issue',
        code: 'DI_ERROR',
        fix: 'Ensure all dependencies are properly registered in the module providers array.',
        relatedDocs: '/docs/dependency-injection',
      },
    ]);
  }

  static enhanceError(
    error: Error | HttpError,
    context?: Record<string, unknown>,
    requestId?: string
  ): EnhancedError {
    const enhancedError = error as EnhancedError;
    enhancedError.suggestions = this.getSuggestions(error);
    enhancedError.context = context;
    enhancedError.requestId = requestId;

    // Add helpful context based on error type
    if (error.message.includes('Cannot resolve dependency')) {
      enhancedError.suggestions.push({
        message: 'Dependency injection issue detected',
        code: 'DEPENDENCY_RESOLUTION',
        fix: 'Make sure the dependency is registered in the module providers or imported modules.',
        relatedDocs: '/docs/dependency-injection',
      });
    }

    if (error.message.includes('Route not found')) {
      enhancedError.suggestions.push({
        message: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        fix: 'Check the controller path and method decorators. Ensure the route is properly registered.',
        relatedDocs: '/docs/routing',
      });
    }

    if (error.message.includes('validation')) {
      enhancedError.suggestions.push({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fix: 'Check your DTO class and validation decorators. Ensure required fields are marked.',
        relatedDocs: '/docs/validation',
      });
    }

    return enhancedError;
  }

  static getSuggestions(error: Error): ErrorSuggestion[] {
    for (const [errorType, suggestions] of this.suggestionMap) {
      if (error.constructor.name === errorType || error.message.includes(errorType)) {
        return suggestions;
      }
    }

    // Default suggestions for unknown errors
    return [
      {
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        fix: 'Check the server logs for more details. Contact support if the issue persists.',
        relatedDocs: '/docs/troubleshooting',
      },
    ];
  }

  static addCustomSuggestions(errorType: string, suggestions: ErrorSuggestion[]): void {
    this.suggestionMap.set(errorType, suggestions);
  }

  static formatErrorResponse(error: EnhancedError): Record<string, unknown> {
    const response: Record<string, unknown> = {
      error: {
        message: error.message,
        statusCode: (error as HttpError).statusCode || 500,
        timestamp: new Date().toISOString(),
      },
    };

    if (error.requestId) {
      (response.error as Record<string, unknown>).requestId = error.requestId;
    }

    // Include suggestions in development mode
    if (process.env.NODE_ENV === 'development' && error.suggestions.length > 0) {
      (response.error as Record<string, unknown>).suggestions = error.suggestions;
    }

    // Include context in development mode
    if (process.env.NODE_ENV === 'development' && error.context) {
      (response.error as Record<string, unknown>).context = error.context;
    }

    return response;
  }

  static logEnhancedError(error: EnhancedError): void {
    logger.error(`Enhanced Error [${error.requestId || 'unknown'}]:`, {
      message: error.message,
      statusCode: (error as HttpError).statusCode || 500,
      suggestions: error.suggestions.map(s => s.message),
      context: error.context,
    });

    // Log suggestions in debug mode
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Error suggestions:', error.suggestions);
    }
  }
}

// Helper function to create enhanced errors
export function createEnhancedError(
  message: string,
  statusCode: number = 500,
  suggestions?: ErrorSuggestion[],
  context?: Record<string, unknown>
): EnhancedError {
  const error = new HttpError(statusCode, message) as EnhancedError;
  error.suggestions = suggestions || [];
  error.context = context;
  return error;
}

// Common enhanced error creators
export const EnhancedErrors = {
  validationFailed: (details?: string): EnhancedError => createEnhancedError(
    `Validation failed${details ? `: ${details}` : ''}`,
    400,
    [
      {
        message: 'Request validation failed',
        code: 'VALIDATION_FAILED',
        fix: 'Check your request body format and required fields',
        relatedDocs: '/docs/validation',
      },
    ]
  ),

  unauthorized: (details?: string): EnhancedError => createEnhancedError(
    `Unauthorized${details ? `: ${details}` : ''}`,
    401,
    [
      {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        fix: 'Provide valid authentication credentials',
        relatedDocs: '/docs/authentication',
      },
    ]
  ),

  notFound: (resource?: string): EnhancedError => createEnhancedError(
    `${resource || 'Resource'} not found`,
    404,
    [
      {
        message: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
        fix: 'Check the resource ID and endpoint path',
        relatedDocs: '/docs/endpoints',
      },
    ]
  ),

  methodNotAllowed: (method?: string): EnhancedError => createEnhancedError(
    `Method ${method || 'used'} not allowed`,
    405,
    [
      {
        message: 'HTTP method not supported',
        code: 'METHOD_NOT_ALLOWED',
        fix: 'Check allowed HTTP methods for this endpoint',
        relatedDocs: '/docs/http-methods',
      },
    ]
  ),

  rateLimitExceeded: (retryAfter?: number): EnhancedError => createEnhancedError(
    'Rate limit exceeded',
    429,
    [
      {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        fix: `Wait ${retryAfter || 'a few seconds'} before retrying`,
        relatedDocs: '/docs/rate-limiting',
      },
    ]
  ),
};
