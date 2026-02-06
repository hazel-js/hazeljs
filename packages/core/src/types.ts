// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Type<T = unknown> = new (...args: any[]) => T;

export interface ModuleMetadata {
  imports?: Type<unknown>[];
  controllers: Type<unknown>[];
  providers: Type<unknown>[];
  exports?: Type<unknown>[];
  middlewares?: Type<unknown>[];
}

export interface ControllerMetadata {
  path: string;
  middlewares?: Type<unknown>[];
}

export interface InjectableMetadata {
  scope?: 'singleton' | 'transient';
}

export interface RouteMetadata {
  path: string;
  method: string;
  handler: string | symbol;
  middlewares?: Type<unknown>[];
}

export interface ProviderMetadata {
  token: string | symbol | Type<unknown>;
  useValue?: unknown;
  useClass?: Type<unknown>;
  useFactory?: (...args: unknown[]) => unknown;
  deps?: Type<unknown>[];
}

export type Request = {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
};

export type Response = {
  status: (code: number) => Response;
  json: (data: unknown) => void;
  send: (data: string) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  dtoType?: Type<unknown>;
  user?: {
    id: string | number;
    username?: string;
    role: string;
    [key: string]: unknown;
  };
  req?: Request; // Express request object
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  properties?: ValidationSchema;
  items?: ValidationRule;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
}
