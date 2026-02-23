/**
 * HazelJS Core Framework
 * A modern, modular Node.js framework with TypeScript support
 */

// Import reflect-metadata to enable decorator metadata
// Users don't need to import this manually
import 'reflect-metadata';

// Core exports
export { HazelApp, type EarlyHttpHandler } from './hazel-app';
export { HazelModule, Module, HazelModuleInstance, getModuleMetadata } from './hazel-module';
export type { ModuleOptions, DynamicModule } from './hazel-module';

// Shutdown & Health
export { ShutdownManager } from './shutdown';
export type { ShutdownHandler } from './shutdown';
export { HealthCheckManager, BuiltInHealthChecks } from './health';
export type { HealthCheck, HealthCheckResult, HealthStatus } from './health';

// Timeout Middleware (new)
export { TimeoutMiddleware } from './middleware/timeout.middleware';
export type { TimeoutOptions } from './middleware/timeout.middleware';

// Decorators
export {
  Controller,
  Injectable,
  Service,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  HttpCode,
  Header,
  Redirect,
  Inject,
  UsePipes,
  UseInterceptors,
  UseGuards,
  type ControllerMetadata,
  type RouteMetadata,
  type ControllerOptions,
  type RouteOptions,
  type ServiceOptions,
  type InjectableOptions,
  type RepositoryOptions,
  type OnModuleInit,
  type OnModuleDestroy,
  type ExecutionContext,
  type CanActivate,
} from './decorators';

// Container & DI
export { Container, Scope, type InjectionToken, type Provider } from './container';

// Types
export type { Type, Request, Response, RequestContext, ValidationSchema } from './types';

// Errors
export {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from './errors/http.error';

// Pipes
export { PipeTransform, ValidationError, ParseIntPipe, type PipeMetadata } from './pipes/pipe';
export { ValidationPipe } from './pipes/validation.pipe';

// Interceptors
export { Interceptor, type InterceptorMetadata } from './interceptors/interceptor';

// Filters
export {
  type ExceptionFilter,
  type ArgumentsHost,
  ArgumentsHostImpl,
  Catch,
  getFilterExceptions,
} from './filters/exception-filter';
export { HttpExceptionFilter } from './filters/http-exception.filter';

// Testing
export {
  Test,
  TestingModule,
  TestingModuleBuilder,
  type TestingModuleMetadata,
} from './testing/testing.module';

// Routing
export { RouteMatcher, type RouteMatch } from './routing/route-matcher';
export {
  Version,
  VersioningType,
  type VersioningOptions,
  getVersionMetadata,
  matchVersion,
  extractVersion,
} from './routing/version.decorator';

// Middleware
export {
  GlobalMiddlewareManager,
  CorsMiddleware,
  LoggerMiddleware,
  type MiddlewareFunction,
  type MiddlewareClass,
  type MiddlewareConsumer,
  type MiddlewareConfigProxy,
  type RouteInfo,
  type NextFunction,
  type CorsOptions,
} from './middleware/global-middleware';
export { Middleware, type MiddlewareHandler } from './middleware';
export {
  SecurityHeadersMiddleware,
  type SecurityHeadersOptions,
} from './middleware/security-headers.middleware';
export {
  RateLimitMiddleware,
  type RateLimitOptions,
} from './middleware/rate-limit.middleware';
export {
  CsrfMiddleware,
  type CsrfOptions,
} from './middleware/csrf.middleware';

// File Upload
export {
  FileUploadInterceptor,
  UploadedFileDecorator as UploadedFile,
  UploadedFilesDecorator as UploadedFiles,
  type UploadedFile as UploadedFileType,
  type FileUploadOptions,
} from './upload/file-upload';

// Logger
export { default as logger } from './logger';
export { default } from './logger';

// Validator
export { Validator } from './validator';

// Router
export { Router } from './router';

// Request utilities
export { RequestParser } from './request-parser';
export { RequestContext as RequestContextClass } from './request-context';
export { HazelResponse } from './hazel-response';

// Security utilities
export {
  sanitizeHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeSql,
  sanitizeObject,
  escapeHtml,
} from './utils/sanitize';
