/**
 * Decorator-based flow definitions
 */
import 'reflect-metadata';
import type {
  FlowDefinition,
  NodeDefinition,
  EdgeDefinition,
  FlowContext,
  NodeResult,
  RetryPolicy,
} from '../types/FlowTypes.js';

const FLOW_METADATA_KEY = 'flow:definition';
const NODE_METADATA_KEY = 'flow:nodes';
const EDGE_METADATA_KEY = 'flow:edges';
const ENTRY_METADATA_KEY = 'flow:entry';

export interface NodeDecoratorOptions {
  name?: string;
  retry?: RetryPolicy;
  timeoutMs?: number;
  idempotencyKey?: (ctx: FlowContext) => string;
}

/**
 * Mark a class as a flow definition
 */
export function Flow(flowId: string, version: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(FLOW_METADATA_KEY, { flowId, version }, target);
  };
}

/**
 * Mark a node as the entry point
 */
export function Entry(): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(ENTRY_METADATA_KEY, true, target, propertyKey);
  };
}

/**
 * Mark a method as a flow node. Method name is used as nodeId if not provided.
 */
export function Node(
  nodeIdOrOptions?: string | NodeDecoratorOptions,
  options?: NodeDecoratorOptions
): MethodDecorator {
  const nodeId = typeof nodeIdOrOptions === 'string' ? nodeIdOrOptions : undefined;
  const opts = (typeof nodeIdOrOptions === 'object' ? nodeIdOrOptions : options) ?? {};
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const id = nodeId ?? (typeof propertyKey === 'string' ? propertyKey : String(propertyKey));
    Reflect.defineMetadata(NODE_METADATA_KEY, { id, options: opts }, target, propertyKey);
    return descriptor;
  };
}

/**
 * Add an edge from this node to another. Stack multiple for branching.
 */
export function Edge(
  to: string,
  when?: (ctx: FlowContext) => boolean,
  priority?: number
): MethodDecorator {
  return (target, propertyKey) => {
    const from = typeof propertyKey === 'string' ? propertyKey : String(propertyKey);
    const edges: EdgeDefinition[] =
      Reflect.getMetadata(EDGE_METADATA_KEY, target, propertyKey) ?? [];
    edges.push({ from, to, when, priority: priority ?? 0 });
    Reflect.defineMetadata(EDGE_METADATA_KEY, edges, target, propertyKey);
  };
}

/**
 * Build a FlowDefinition from a decorated flow class
 */
export function buildFlowDefinition(FlowClass: new () => object): FlowDefinition {
  const flowMeta = Reflect.getMetadata(FLOW_METADATA_KEY, FlowClass);
  if (!flowMeta) {
    throw new Error(`Class ${FlowClass.name} is not decorated with @Flow(flowId, version)`);
  }

  const { flowId, version } = flowMeta;
  const prototype = FlowClass.prototype;
  const nodes: Record<string, NodeDefinition> = {};
  const edges: EdgeDefinition[] = [];
  let entryNodeId: string | null = null;

  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (k) => k !== 'constructor' && typeof prototype[k] === 'function'
  );

  const instance = new FlowClass();

  for (const methodName of methodNames) {
    const nodeMeta = Reflect.getMetadata(NODE_METADATA_KEY, prototype, methodName);
    if (!nodeMeta) continue;

    const { id: nodeId, options } = nodeMeta;
    const handler = (prototype[methodName] as (ctx: FlowContext) => Promise<NodeResult>).bind(
      instance
    );

    nodes[nodeId] = {
      id: nodeId,
      name: options?.name,
      handler: handler as (ctx: FlowContext) => Promise<NodeResult>,
      retry: options?.retry,
      timeoutMs: options?.timeoutMs,
      idempotencyKey: options?.idempotencyKey,
    };

    if (Reflect.getMetadata(ENTRY_METADATA_KEY, prototype, methodName)) {
      entryNodeId = nodeId;
    }

    const nodeEdges = Reflect.getMetadata(EDGE_METADATA_KEY, prototype, methodName) ?? [];
    edges.push(...nodeEdges);
  }

  if (!entryNodeId) {
    throw new Error(`Flow ${flowId}@${version} must have exactly one @Entry() node`);
  }

  return {
    flowId,
    version,
    entry: entryNodeId,
    nodes,
    edges,
  };
}
