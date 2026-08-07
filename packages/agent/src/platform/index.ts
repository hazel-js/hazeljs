/**
 * Agent OS Platform — declarative control-plane seam (local-first).
 */

export * from './resources';
export * from './schemas';
export * from './repository';
export * from './reconciler';
export * from './resolve-package';
export * from './run-correlation';
export * from './events';
export * from './admission';
export * from './observability';
export * from './backends/local';
export * from './backends/kubernetes-types';
export * from './backends/kubernetes-manifest';
export * from './backends/kubernetes-client';
export * from './backends/kubernetes';
export * from './local-platform';
