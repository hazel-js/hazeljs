/**
 * Organism decorators — follow @Agent (reflect-metadata + global registries).
 */

import 'reflect-metadata';
import type {
  AgentGeneDefinition,
  ConstitutionDefinition,
  EnvironmentDefinition,
  MissionDefinition,
  ResourceDefinition,
} from '../types/organism.types';

type Newable = new (...args: unknown[]) => unknown;

const MISSION_KEY = Symbol('organism:mission');
const ORGANISM_KEY = Symbol('organism:organism');
const GENE_KEY = Symbol('organism:gene');
const ENVIRONMENT_KEY = Symbol('organism:environment');
const CONSTITUTION_KEY = Symbol('organism:constitution');
const RESOURCE_KEY = Symbol('organism:resource');

const MISSION_REGISTRY = new Set<Newable>();
const ORGANISM_REGISTRY = new Set<Newable>();
const GENE_REGISTRY = new Set<Newable>();
const ENVIRONMENT_REGISTRY = new Set<Newable>();
const CONSTITUTION_REGISTRY = new Set<Newable>();
const RESOURCE_REGISTRY = new Set<Newable>();

export interface OrganismDecoratorOptions {
  mission?: Newable | MissionDefinition;
  environment?: Newable | EnvironmentDefinition;
  constitution?: Newable | ConstitutionDefinition;
  genes?: Array<Newable | AgentGeneDefinition>;
  resources?: Newable | ResourceDefinition;
  id?: string;
}

export function Mission(config: MissionDefinition): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(MISSION_KEY, config, target);
    MISSION_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function Organism(config: OrganismDecoratorOptions = {}): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(ORGANISM_KEY, config, target);
    ORGANISM_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function AgentGene(config: AgentGeneDefinition): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(GENE_KEY, config, target);
    GENE_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function Environment(config: EnvironmentDefinition): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(ENVIRONMENT_KEY, config, target);
    ENVIRONMENT_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function Constitution(config: ConstitutionDefinition): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(CONSTITUTION_KEY, config, target);
    CONSTITUTION_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function Resource(config: ResourceDefinition): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    Reflect.defineMetadata(RESOURCE_KEY, config, target);
    RESOURCE_REGISTRY.add(target as Newable);
  }) as ClassDecorator;
}

export function getMissionMetadata(target: Newable): MissionDefinition | undefined {
  return Reflect.getMetadata(MISSION_KEY, target);
}

export function getOrganismMetadata(target: Newable): OrganismDecoratorOptions | undefined {
  return Reflect.getMetadata(ORGANISM_KEY, target);
}

export function getAgentGeneMetadata(target: Newable): AgentGeneDefinition | undefined {
  return Reflect.getMetadata(GENE_KEY, target);
}

export function getEnvironmentMetadata(target: Newable): EnvironmentDefinition | undefined {
  return Reflect.getMetadata(ENVIRONMENT_KEY, target);
}

export function getConstitutionMetadata(target: Newable): ConstitutionDefinition | undefined {
  return Reflect.getMetadata(CONSTITUTION_KEY, target);
}

export function getResourceMetadata(target: Newable): ResourceDefinition | undefined {
  return Reflect.getMetadata(RESOURCE_KEY, target);
}

export function getRegisteredMissions(): Newable[] {
  return Array.from(MISSION_REGISTRY);
}

export function getRegisteredOrganisms(): Newable[] {
  return Array.from(ORGANISM_REGISTRY);
}

export function getRegisteredGenes(): Newable[] {
  return Array.from(GENE_REGISTRY);
}

export function getRegisteredEnvironments(): Newable[] {
  return Array.from(ENVIRONMENT_REGISTRY);
}

export function getRegisteredConstitutions(): Newable[] {
  return Array.from(CONSTITUTION_REGISTRY);
}

export function getRegisteredResources(): Newable[] {
  return Array.from(RESOURCE_REGISTRY);
}

export function resolveMission(input: Newable | MissionDefinition): MissionDefinition {
  if (typeof input === 'function') {
    const meta = getMissionMetadata(input);
    if (!meta) throw new Error(`Class ${input.name} is not decorated with @Mission`);
    return meta;
  }
  return input;
}

export function resolveGene(input: Newable | AgentGeneDefinition): AgentGeneDefinition {
  if (typeof input === 'function') {
    const meta = getAgentGeneMetadata(input);
    if (!meta) throw new Error(`Class ${input.name} is not decorated with @AgentGene`);
    return meta;
  }
  return input;
}

export function resolveEnvironment(input: Newable | EnvironmentDefinition): EnvironmentDefinition {
  if (typeof input === 'function') {
    const meta = getEnvironmentMetadata(input);
    if (!meta) throw new Error(`Class ${input.name} is not decorated with @Environment`);
    return meta;
  }
  return input;
}

export function resolveConstitution(
  input: Newable | ConstitutionDefinition
): ConstitutionDefinition {
  if (typeof input === 'function') {
    const meta = getConstitutionMetadata(input);
    if (!meta) throw new Error(`Class ${input.name} is not decorated with @Constitution`);
    return meta;
  }
  return input;
}

export function resolveResource(input: Newable | ResourceDefinition): ResourceDefinition {
  if (typeof input === 'function') {
    const meta = getResourceMetadata(input);
    if (!meta) throw new Error(`Class ${input.name} is not decorated with @Resource`);
    return meta;
  }
  return input;
}
