import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLID,
} from 'graphql';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { getObjectTypeMetadata } from './decorators/object-type.decorator';
import { getFieldMetadata } from './decorators/field.decorator';
import {
  getQueryMetadata,
  getMutationMetadata,
  getArgMetadata,
} from './decorators/query-mutation.decorator';
import { getResolverMetadata } from './decorators/resolver.decorator';

const SCALAR_MAP: Record<string, GraphQLScalarType> = {
  String: GraphQLString,
  Number: GraphQLFloat,
  number: GraphQLFloat,
  Boolean: GraphQLBoolean,
  boolean: GraphQLBoolean,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  ID: GraphQLID,
};

export class SchemaBuilder {
  private objectTypeCache = new Map<object, GraphQLObjectType>();

  buildSchema(
    resolvers: (new (...args: unknown[]) => object)[],
    container: Container
  ): GraphQLSchema {
    const queryFields: Record<
      string,
      {
        type: unknown;
        args: Record<string, { type: unknown }>;
        resolve: (source: unknown, args: Record<string, unknown>) => unknown;
      }
    > = {};
    const mutationFields: Record<
      string,
      {
        type: unknown;
        args: Record<string, { type: unknown }>;
        resolve: (source: unknown, args: Record<string, unknown>) => unknown;
      }
    > = {};

    for (const ResolverClass of resolvers) {
      void getResolverMetadata(ResolverClass);
      const instance = container.resolve(ResolverClass) as object;

      const queries = getQueryMetadata(ResolverClass);
      for (const q of queries) {
        const args: Record<string, { type: unknown }> = {};
        const argMeta = getArgMetadata(ResolverClass.prototype, q.method);
        for (const a of argMeta.filter(Boolean)) {
          args[a!.name] = { type: this.inferType(a!.type) };
        }
        queryFields[q.name!] = {
          type: this.inferType(undefined),
          args,
          resolve: (_: unknown, args: Record<string, unknown>): unknown => {
            const method = (instance as Record<string, (...a: unknown[]) => unknown>)[q.method];
            if (typeof method !== 'function') {
              logger.warn(`Query handler ${q.method} not found on ${ResolverClass.name}`);
              return null;
            }
            const orderedArgs = argMeta.map((a) => (a ? args[a.name] : undefined));
            return method.apply(instance, orderedArgs);
          },
        };
      }

      const mutations = getMutationMetadata(ResolverClass);
      for (const m of mutations) {
        const args: Record<string, { type: unknown }> = {};
        const argMeta = getArgMetadata(ResolverClass.prototype, m.method);
        for (const a of argMeta.filter(Boolean)) {
          args[a!.name] = { type: this.inferType(a!.type) };
        }
        mutationFields[m.name!] = {
          type: this.inferType(undefined),
          args,
          resolve: (_: unknown, args: Record<string, unknown>): unknown => {
            const method = (instance as Record<string, (...a: unknown[]) => unknown>)[m.method];
            if (typeof method !== 'function') {
              logger.warn(`Mutation handler ${m.method} not found on ${ResolverClass.name}`);
              return null;
            }
            const orderedArgs = argMeta.map((a) => (a ? args[a.name] : undefined));
            return method.apply(instance, orderedArgs);
          },
        };
      }
    }

    const queryType = new GraphQLObjectType({
      name: 'Query',
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      fields: () => queryFields as never,
    });

    const mutationType =
      Object.keys(mutationFields).length > 0
        ? new GraphQLObjectType({
            name: 'Mutation',
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            fields: () => mutationFields as never,
          })
        : undefined;

    return new GraphQLSchema({
      query: queryType,
      ...(mutationType && { mutation: mutationType }),
    });
  }

  private inferType(tsType: unknown, nullable = true): unknown {
    if (tsType === undefined || tsType === null) return GraphQLString;

    const type = tsType as { name?: string; prototype?: object };
    const name = type?.name || String(tsType);

    if (name.endsWith('[]') || name === 'Array') {
      const inner = this.inferType({ name: name.replace('[]', '') });
      return nullable
        ? new GraphQLList(inner as GraphQLScalarType)
        : new GraphQLNonNull(new GraphQLList(inner as GraphQLScalarType));
    }

    const scalar = SCALAR_MAP[name];
    if (scalar) return nullable ? scalar : new GraphQLNonNull(scalar);

    const objMeta = type?.prototype && getObjectTypeMetadata(type.prototype as object);
    if (objMeta) {
      let objType = this.objectTypeCache.get(type.prototype as object);
      if (!objType) {
        objType = this.buildObjectType(type as new () => object);
        this.objectTypeCache.set(type.prototype as object, objType);
      }
      return nullable ? objType : new GraphQLNonNull(objType);
    }

    return GraphQLString;
  }

  private buildObjectType(cls: new () => object): GraphQLObjectType {
    const meta = getObjectTypeMetadata(cls.prototype) || { name: (cls as { name: string }).name };
    const fieldsMeta = getFieldMetadata(cls.prototype) || [];

    const fields: Record<string, { type: unknown; resolve?: (source: unknown) => unknown }> = {};
    for (const f of fieldsMeta) {
      if (!f) continue;
      fields[f.name] = {
        type: this.inferType(f.type),
        resolve: (source: unknown): unknown => {
          const val = (source as Record<string, unknown>)?.[f.name];
          if (typeof val === 'function') return val.call(source);
          return val;
        },
      };
    }

    return new GraphQLObjectType({
      name: meta.name,
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      fields: () => fields as never,
    });
  }
}
