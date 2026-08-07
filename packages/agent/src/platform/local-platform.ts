/**
 * Convenience wiring for local / CLI use: file-backed repo + local backend +
 * project/registry package resolution + durable run correlation +
 * admission/events + optional Kubernetes backend (Phase 4 spike).
 */

import * as path from 'path';
import { LocalDeploymentBackend } from './backends/local';
import {
  KubernetesDeploymentBackend,
  type KubernetesDeploymentBackendOptions,
} from './backends/kubernetes';
import type { KubernetesWorkloadClient } from './backends/kubernetes-types';
import {
  DEFAULT_PLATFORM_EVENTS,
  FilePlatformEventSink,
  InMemoryPlatformEventSink,
  type PlatformEventSink,
} from './events';
import { PlatformReconciler } from './reconciler';
import type { ReconcileAllOptions, ReconcileAllResult } from './reconciler';
import {
  FileResourceRepository,
  InMemoryResourceRepository,
  type ResourceRepository,
} from './repository';
import {
  createCompositePackageResolver,
  createPackageResolverFromRegistry,
  type PackageResolver,
} from './resolve-package';
import { createAgentPackageRegistry } from '../store/create-registry';
import type { AgentPackageRegistry } from '../store/registry';
import { createFileDurableRunLookup, type DurableRunLookup } from './run-correlation';
import type { AgentDeployment, DeploymentBackend } from './resources';
import { conditionOf, metaNamespace } from './resources';
import type { PolicyRule } from '../policies/policy.engine';
import {
  PolicyAdmissionController,
  type AdmissionController,
  type PolicyAdmissionOptions,
} from './admission';

export {
  createCompositePackageResolver,
  createPackageResolverFromRegistry,
} from './resolve-package';
export { createFileDurableRunLookup } from './run-correlation';

export interface CreateLocalPlatformOptions {
  /** Persist repository here (FileResourceRepository). */
  storePath?: string;
  /** Append-only events JSONL (default beside store). */
  eventsPath?: string;
  /** Disable file events (use in-memory only). */
  events?: boolean | PlatformEventSink;
  /** Project root for `.hazel/agents` packageRef resolution. */
  projectRoot?: string;
  /** Local package registry root for packageRef resolution. */
  registryRoot?: string;
  /** Hosted registry base URL (Cloud Team SKU). */
  remoteRegistryUrl?: string;
  /** Hosted registry bearer token. */
  remoteRegistryToken?: string;
  /** Injected remote/local AgentPackageRegistry for packageRef. */
  remoteRegistry?: import('../store/registry').AgentPackageRegistry;
  resolvePackage?: PackageResolver;
  /** Durable AgentRun file store (`.hazel/agent-runs.json`). */
  runsPath?: string;
  /** Durable store directory (runs + checkpoints). */
  durableDir?: string;
  /** Timeline JSONL for AgentRun correlation step counts. */
  timelinePath?: string;
  durableRunLookup?: DurableRunLookup;
  /** Admission rules / controller (default: allow-all PolicyAdmissionController). */
  admission?: AdmissionController | PolicyAdmissionOptions | false;
  admissionRules?: PolicyRule[];
  actor?: string;
  /**
   * Register Kubernetes backend as runtimeClass `kubernetes` and `k8s`.
   * Pass a workload client, or `{ forceDryRun: true }` / client options.
   */
  kubernetes?: boolean | KubernetesWorkloadClient | KubernetesDeploymentBackendOptions;
}

export interface LocalPlatform {
  repo: ResourceRepository;
  backend: LocalDeploymentBackend;
  kubernetesBackend?: KubernetesDeploymentBackend;
  reconciler: PlatformReconciler;
  events: PlatformEventSink;
  /** No-op when using FileResourceRepository (auto-persists). */
  save(): void;
  load(): void;
  /** Reconcile all Deployments/Runs once. */
  reconcileAll(options?: ReconcileAllOptions): Promise<ReconcileAllResult>;
}

export interface WatchLocalPlatformOptions extends ReconcileAllOptions {
  /** Poll interval (default 5000ms). */
  intervalMs?: number;
  /** Abort to stop the loop. */
  signal?: AbortSignal;
  /** Called after each reconcileAll tick. */
  onTick?: (result: ReconcileAllResult, tick: number) => void | Promise<void>;
}

function resolveEventsSink(
  options: CreateLocalPlatformOptions,
  storePath?: string
): PlatformEventSink {
  if (options.events === false) return new InMemoryPlatformEventSink();
  if (options.events && typeof options.events === 'object') return options.events;
  const eventsPath =
    options.eventsPath ??
    (storePath
      ? path.join(path.dirname(path.resolve(storePath)), 'events.jsonl')
      : path.resolve(DEFAULT_PLATFORM_EVENTS));
  return new FilePlatformEventSink(eventsPath);
}

function resolveAdmission(options: CreateLocalPlatformOptions): AdmissionController | undefined {
  if (options.admission === false) return undefined;
  if (options.admission && typeof (options.admission as AdmissionController).admit === 'function') {
    return options.admission as AdmissionController;
  }
  const opts =
    options.admission && typeof options.admission === 'object'
      ? (options.admission as PolicyAdmissionOptions)
      : {};
  return new PolicyAdmissionController({
    ...opts,
    rules: options.admissionRules ?? opts.rules,
  });
}

export function createLocalPlatform(options: CreateLocalPlatformOptions = {}): LocalPlatform {
  const storePath = options.storePath;
  const repo: ResourceRepository = storePath
    ? new FileResourceRepository(path.resolve(storePath))
    : new InMemoryResourceRepository();

  const backend = new LocalDeploymentBackend();
  const events = resolveEventsSink(options, storePath);
  const admission = resolveAdmission(options);

  // Rehydrate local backend observations from persisted deployment status.
  for (const resource of repo.list({ kind: 'AgentDeployment' })) {
    const dep = resource as AgentDeployment;
    const ready = conditionOf(dep.status, 'Ready')?.status === 'True';
    if (ready && dep.status?.backend) {
      backend.seed(
        {
          name: dep.metadata.name,
          namespace: metaNamespace(dep.metadata),
          kind: 'AgentDeployment',
        },
        {
          ready: true,
          message: dep.status.message ?? 'Restored from platform store',
          observed: dep.status.backend,
        }
      );
    }
  }

  const remoteRegistry: AgentPackageRegistry | undefined =
    options.remoteRegistry ??
    (options.remoteRegistryUrl || process.env.HAZEL_REGISTRY_URL
      ? createAgentPackageRegistry({
          remote: options.remoteRegistryUrl ?? process.env.HAZEL_REGISTRY_URL,
          token: options.remoteRegistryToken ?? process.env.HAZEL_REGISTRY_TOKEN,
        })
      : undefined);

  const resolvePackage =
    options.resolvePackage ??
    createCompositePackageResolver({
      projectRoot: options.projectRoot ?? process.cwd(),
      registryRoot: options.registryRoot,
      remoteRegistry,
    });

  const durableRunLookup =
    options.durableRunLookup ??
    (options.runsPath || options.durableDir || options.timelinePath
      ? createFileDurableRunLookup({
          runsPath: options.runsPath,
          durableDir: options.durableDir,
          timelinePath: options.timelinePath,
        })
      : createFileDurableRunLookup({
          runsPath: path.join(options.projectRoot ?? process.cwd(), '.hazel', 'agent-runs.json'),
          durableDir: path.join(options.projectRoot ?? process.cwd(), '.hazel', 'runs'),
          timelinePath: path.join(
            options.projectRoot ?? process.cwd(),
            '.hazel',
            'runs',
            'timeline.jsonl'
          ),
        }));

  const backends: Record<string, DeploymentBackend> = { local: backend };
  let kubernetesBackend: KubernetesDeploymentBackend | undefined;
  if (options.kubernetes) {
    const k8sOpts: KubernetesDeploymentBackendOptions =
      options.kubernetes === true
        ? { forceDryRun: true }
        : typeof (options.kubernetes as KubernetesWorkloadClient).applyDeployment === 'function'
          ? { client: options.kubernetes as KubernetesWorkloadClient }
          : (options.kubernetes as KubernetesDeploymentBackendOptions);
    kubernetesBackend = new KubernetesDeploymentBackend(k8sOpts);
    backends.kubernetes = kubernetesBackend;
    backends.k8s = kubernetesBackend;
  }

  const reconciler = new PlatformReconciler(repo, {
    backends,
    resolvePackage,
    durableRunLookup,
    admission,
    events,
    actor: options.actor ?? 'cli',
    defaultRuntimeClass: 'local',
  });

  const load = (): void => {
    if (repo instanceof FileResourceRepository) repo.load();
  };

  const save = (): void => {
    if (repo instanceof FileResourceRepository) repo.persist();
  };

  return {
    repo,
    backend,
    kubernetesBackend,
    reconciler,
    events,
    save,
    load,
    reconcileAll: (opts) => reconciler.reconcileAll(opts),
  };
}

/**
 * Embedded local control-plane loop: periodically reconcile Deployments/Runs.
 * Stop via AbortSignal (CLI uses SIGINT). Does not claim leader election / multi-process locks.
 */
export async function watchLocalPlatform(
  platform: LocalPlatform,
  options: WatchLocalPlatformOptions = {}
): Promise<void> {
  const intervalMs = Math.max(250, options.intervalMs ?? 5_000);
  let tick = 0;
  const { signal, onTick, intervalMs: _ignored, ...reconcileOpts } = options;
  void _ignored;

  while (!signal?.aborted) {
    tick += 1;
    const result = await platform.reconcileAll(reconcileOpts);
    await onTick?.(result, tick);
    if (signal?.aborted) break;
    await sleep(intervalMs, signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export const DEFAULT_PLATFORM_STORE = path.join('.hazel', 'platform', 'resources.json');
export { DEFAULT_PLATFORM_EVENTS };
