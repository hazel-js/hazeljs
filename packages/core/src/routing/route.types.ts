import type { Request, Response, RequestContext } from '../types';

export type RouteHandler = (req: Request, res: Response, context?: RequestContext) => void;

/** Single registered route (path + handlers + optional API version constraint). */
export interface RouteEntry {
  handlers: RouteHandler[];
  versions?: string[];
}
