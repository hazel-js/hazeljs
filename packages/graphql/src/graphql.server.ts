import { Injectable } from '@hazeljs/core';
import { createHandler } from 'graphql-http/lib/use/http';
import type { IncomingMessage, ServerResponse } from 'http';
import { GraphQLSchema } from 'graphql';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { SchemaBuilder } from './schema-builder';
import type { GraphQLModuleConfig } from './graphql.types';

/**
 * GraphQL Server - builds schema from decorators and serves via graphql-http
 */
@Injectable()
export class GraphQLServer {
  private schema: GraphQLSchema | null = null;
  private handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
  private path = '/graphql';
  private config: GraphQLModuleConfig = {};

  constructor(
    private readonly resolvers: (new (...args: unknown[]) => object)[],
    private readonly container: Container
  ) {}

  configure(config: GraphQLModuleConfig): void {
    this.config = config;
    this.path = config.path ?? '/graphql';
    logger.info('GraphQL server configured', { path: this.path });
  }

  /**
   * Build schema and create the HTTP handler
   */
  build(): void {
    const builder = new SchemaBuilder();
    this.schema = builder.buildSchema(this.resolvers, this.container);
    this.handler = createHandler({
      schema: this.schema,
    }) as (req: IncomingMessage, res: ServerResponse) => void;
    logger.info('GraphQL schema built from resolvers');
  }

  /**
   * Get the path where GraphQL is served
   */
  getPath(): string {
    return this.path;
  }

  /**
   * Handle incoming GraphQL request (call this for req.url matching path)
   */
  getHandler(): (req: IncomingMessage, res: ServerResponse) => void {
    if (!this.handler) this.build();
    return this.handler!;
  }

  /**
   * Get the built schema
   */
  getSchema(): GraphQLSchema | null {
    return this.schema;
  }
}
