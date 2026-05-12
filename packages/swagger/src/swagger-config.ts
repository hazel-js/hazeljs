import type { SwaggerModuleOptions } from './swagger.types';

let swaggerModuleOptions: SwaggerModuleOptions = {};

export function mergeSwaggerModuleOptions(options: SwaggerModuleOptions): void {
  swaggerModuleOptions = { ...swaggerModuleOptions, ...options };
}

export function replaceSwaggerModuleOptions(options: SwaggerModuleOptions): void {
  swaggerModuleOptions = { ...options };
}

export function getSwaggerModuleOptions(): SwaggerModuleOptions {
  return { ...swaggerModuleOptions };
}
