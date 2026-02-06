import { Type } from './types';

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
}
