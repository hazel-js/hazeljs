/**
 * gRPC inspector plugin - inspects @GrpcMethod handlers
 * Optional: requires @hazeljs/grpc to be installed
 */

import 'reflect-metadata';
import type {
  InspectorContext,
  InspectorEntry,
  GrpcInspectorEntry,
  HazelInspectorPlugin,
} from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetGrpcModule(): { getGrpcMethodMetadata: (t: object) => Array<{ service: string; method: string; methodName: string }> } | null {
  try {
    return require('@hazeljs/grpc');
  } catch {
    return null;
  }
}

export const grpcInspector: HazelInspectorPlugin = {
  name: 'grpc',
  version: '1.0.0',
  supports: () => tryGetGrpcModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const grpcMod = tryGetGrpcModule();
    if (!grpcMod) return [];

    const entries: GrpcInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      // getGrpcMethodMetadata expects target.constructor to be the class; pass prototype when token is a class
      const target = (token as { prototype?: object }).prototype ?? (token as object);
      const methods = grpcMod.getGrpcMethodMetadata(target);
      if (!methods?.length) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      for (const m of methods) {
        entries.push({
          id: createId('grpc', m.service, m.method),
          kind: 'grpc',
          packageName: '@hazeljs/grpc',
          sourceType: 'method',
          className,
          methodName: m.method,
          serviceName: m.service,
        });
      }
    }

    return entries;
  },
};
