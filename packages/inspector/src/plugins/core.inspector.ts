/**
 * Core inspector plugin - routes, modules, providers, decorators
 * Uses @hazeljs/core utilities: collectControllersFromModule, collectModulesFromModule, getModuleMetadata
 */

import 'reflect-metadata';
import {
  collectControllersFromModule,
  collectModulesFromModule,
  getModuleMetadata,
} from '@hazeljs/core';
import type {
  InspectorContext,
  InspectorEntry,
  RouteInspectorEntry,
  ModuleInspectorEntry,
  ProviderInspectorEntry,
  DecoratorInspectorEntry,
} from '../contracts/types';

const CONTROLLER_METADATA_KEY = 'hazel:controller';
const ROUTE_METADATA_KEY = 'hazel:routes';

function normalizePath(path: string): string {
  let p = path || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function createId(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].filter(Boolean).join(':');
}

import type { HazelInspectorPlugin } from '../contracts/types';

export const coreInspector: HazelInspectorPlugin = {
  name: 'core',
  version: '1.0.0',
  supports: () => true,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const entries: InspectorEntry[] = [];
    const { moduleType, container } = context;

    // Routes from controllers
    const controllersRaw = collectControllersFromModule(moduleType);
    const controllers = Array.isArray(controllersRaw) ? controllersRaw : [];
    for (const controller of controllers) {
      const controllerMeta = Reflect.getMetadata(CONTROLLER_METADATA_KEY, controller) || {};
      const controllerPath = controllerMeta.path || '';
      const controllerName = (controller as { name?: string }).name || 'Unknown';

      const routeMetaRaw = Reflect.getMetadata(ROUTE_METADATA_KEY, controller);
      const routeMetaList = Array.isArray(routeMetaRaw) ? routeMetaRaw : [];
      for (const routeMeta of routeMetaList) {
        const { method, path, propertyKey } = routeMeta;
        const routePath = path || '';
        const fullPath = normalizePath(controllerPath + routePath);

        const guardsRaw =
          Reflect.getMetadata('hazel:guards', controller.prototype, propertyKey) ||
          Reflect.getMetadata('hazel:guards', controller) ||
          [];
        const interceptorsRaw =
          Reflect.getMetadata('hazel:interceptors', controller, propertyKey) ||
          Reflect.getMetadata('hazel:class-interceptors', controller) ||
          [];
        const pipesRaw = Reflect.getMetadata('hazel:pipe', controller.prototype, propertyKey) || [];
        const guards = Array.isArray(guardsRaw) ? guardsRaw : [];
        const interceptors = Array.isArray(interceptorsRaw) ? interceptorsRaw : [];
        const pipes = Array.isArray(pipesRaw) ? pipesRaw : [];

        const routeEntry: RouteInspectorEntry = {
          id: createId('route', (method || 'GET').toUpperCase(), fullPath, String(propertyKey)),
          kind: 'route',
          packageName: '@hazeljs/core',
          sourceType: 'method',
          className: controllerName,
          methodName: String(propertyKey),
          httpMethod: (method || 'GET').toUpperCase(),
          fullPath,
          controllerPath: normalizePath(controllerPath),
          routePath,
          guards: guards.map((g: { name?: string }) => g?.name ?? String(g)),
          interceptors: interceptors.map((i: { name?: string }) => i?.name ?? String(i)),
          pipes: pipes.map((p: { type?: { name?: string } }) => p?.type?.name ?? String(p)),
        };
        entries.push(routeEntry);
      }
    }

    // Modules
    const modulesRaw = collectModulesFromModule(moduleType);
    const modules = Array.isArray(modulesRaw) ? modulesRaw : [];
    for (const { moduleType: modRef, name, isDynamic } of modules) {
      const metadata = getModuleMetadata(modRef as object);
      const moduleEntry: ModuleInspectorEntry = {
        id: createId('module', name),
        kind: 'module',
        packageName: '@hazeljs/core',
        moduleName: name,
        dynamicModule: isDynamic,
        imports: (metadata?.imports?.map((m: unknown) =>
          m && typeof m === 'object' && 'module' in m
            ? (m as { module: { name?: string } }).module?.name ?? 'DynamicModule'
            : (m as { name?: string })?.name ?? 'DynamicModule'
        ) ?? []) as string[],
        providers: (metadata?.providers?.map((p: unknown) =>
          p && typeof p === 'object' && 'provide' in p
            ? String((p as { provide: unknown }).provide)
            : (p as { name?: string })?.name ?? 'Unknown'
        ) ?? []) as string[],
        controllers: metadata?.controllers?.map((c: unknown) => (c as { name?: string })?.name ?? 'Unknown') ?? [],
        exports: metadata?.exports?.map((e: unknown) => (e as { name?: string })?.name ?? String(e)) ?? [],
      };
      entries.push(moduleEntry);
    }

    // Providers from modules + container
    const seenProviders = new Set<string>();
    for (const { moduleType: modRef, name: moduleName } of modules) {
      const metadata = getModuleMetadata(modRef as object);
      const providerList = metadata?.providers ?? (modRef as { providers?: unknown[] }).providers;

      if (providerList) {
        for (const provider of providerList) {
          if (provider && typeof provider === 'object' && ('provide' in provider || 'token' in provider)) {
            const p = provider as { provide?: unknown; token?: unknown; useClass?: { name?: string } };
            const token = p.token ?? p.provide;
            const displayName: string =
              typeof token === 'function'
                ? (token as { name?: string }).name ?? 'Unknown'
                : typeof token === 'symbol'
                  ? token.toString()
                  : String(token);
            const providerName = p.useClass?.name ?? displayName;
            if (!seenProviders.has(providerName)) {
              seenProviders.add(providerName);
              const scope =
                (typeof token === 'function' ? Reflect.getMetadata('hazel:scope', token) : undefined) ??
                'singleton';
              entries.push({
                id: createId('provider', providerName),
                kind: 'provider',
                packageName: '@hazeljs/core',
                providerName,
                token: providerName,
                scope: scope as 'singleton' | 'transient' | 'request',
                moduleName,
              } as ProviderInspectorEntry);
            }
          } else {
            const cls = provider as { name?: string };
            const name = cls?.name ?? 'Unknown';
            if (!seenProviders.has(name)) {
              seenProviders.add(name);
              const scope =
                Reflect.getMetadata('hazel:scope', provider as object) ?? 'singleton';
              entries.push({
                id: createId('provider', name),
                kind: 'provider',
                packageName: '@hazeljs/core',
                providerName: name,
                token: name,
                scope: scope as 'singleton' | 'transient' | 'request',
                moduleName,
              } as ProviderInspectorEntry);
            }
          }
        }
      }
    }

    // Container tokens - use class/function name, never String(token) which dumps full source
    try {
      const tokensRaw = container.getTokens?.() ?? [];
      const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
      for (const token of tokens) {
        const displayName =
          typeof token === 'function'
            ? (token as { name?: string }).name
            : typeof token === 'symbol'
              ? token.toString()
              : typeof token === 'string'
                ? token
                : null;
        if (!displayName || seenProviders.has(displayName) || displayName.includes('Object')) continue;
        seenProviders.add(displayName);
        const scope =
          (typeof token === 'function' ? Reflect.getMetadata('hazel:scope', token) : undefined) ??
          'singleton';
        entries.push({
          id: createId('provider', displayName),
          kind: 'provider',
          packageName: '@hazeljs/core',
          providerName: displayName,
          token: displayName,
          scope: scope as 'singleton' | 'transient' | 'request',
          moduleName: undefined,
        } as ProviderInspectorEntry);
      }
    } catch {
      // ignore
    }

    // Decorators on controllers (route decorators)
    for (const controller of controllers) {
      const controllerName = (controller as { name?: string }).name || 'Unknown';
      const routeMetaRaw2 = Reflect.getMetadata(ROUTE_METADATA_KEY, controller);
      const routeMetaList2 = Array.isArray(routeMetaRaw2) ? routeMetaRaw2 : [];
      for (const routeMeta of routeMetaList2) {
        const { method, propertyKey } = routeMeta;
        entries.push({
          id: createId('decorator', controllerName, String(propertyKey), method),
          kind: 'decorator',
          packageName: '@hazeljs/core',
          sourceType: 'method',
          className: controllerName,
          methodName: String(propertyKey),
          decoratorName: method?.toLowerCase() ?? 'get',
          targetType: 'method',
          targetClass: controllerName,
          targetMethod: String(propertyKey),
          rawMetadataKey: ROUTE_METADATA_KEY,
        } as DecoratorInspectorEntry);
      }
    }

    return entries;
  },
};
