/**
 * GraphQL inspector plugin - inspects @Resolver with @Query/@Mutation
 * Optional: requires @hazeljs/graphql to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  GraphQLInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';
import { collectControllersFromModule } from '@hazeljs/core';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetGraphQLModule(): {
  getResolverMetadata: (t: object) => { name?: string } | undefined;
  getQueryMetadata: (t: object) => Array<{ name?: string; method?: string }>;
  getMutationMetadata: (t: object) => Array<{ name?: string; method?: string }>;
} | null {
  try {
    return require('@hazeljs/graphql');
  } catch {
    return null;
  }
}

export const graphqlInspector: HazelInspectorPlugin = {
  name: 'graphql',
  version: '1.0.0',
  supports: () => tryGetGraphQLModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const gqlMod = tryGetGraphQLModule();
    if (!gqlMod) return [];

    const entries: GraphQLInspectorEntry[] = [];
    const controllers = collectControllersFromModule(context.moduleType);
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];
    const allClasses = [...controllers, ...tokens.filter((t): t is (new (...args: unknown[]) => object) => typeof t === 'function')];

    for (const ctrl of allClasses) {
      if (typeof ctrl !== 'function') continue;
      const resolverMeta = gqlMod.getResolverMetadata(ctrl as object);
      const queries = gqlMod.getQueryMetadata(ctrl as object) ?? [];
      const mutations = gqlMod.getMutationMetadata(ctrl as object) ?? [];

      if (queries.length === 0 && mutations.length === 0) continue;

      const className = (ctrl as { name?: string }).name ?? 'Unknown';
      const resolverName = resolverMeta?.name ?? className;

      for (const q of queries) {
        entries.push({
          id: createId('graphql', 'query', resolverName, q.name ?? q.method ?? ''),
          kind: 'graphql',
          packageName: '@hazeljs/graphql',
          sourceType: 'method',
          className,
          methodName: q.method,
          resolverName,
          operationType: 'query',
          operationName: q.name ?? q.method ?? 'unknown',
        });
      }
      for (const m of mutations) {
        entries.push({
          id: createId('graphql', 'mutation', resolverName, m.name ?? m.method ?? ''),
          kind: 'graphql',
          packageName: '@hazeljs/graphql',
          sourceType: 'method',
          className,
          methodName: m.method,
          resolverName,
          operationType: 'mutation',
          operationName: m.name ?? m.method ?? 'unknown',
        });
      }
    }

    return entries;
  },
};
