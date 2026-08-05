/**
 * @AgentSkill — mark a controller / service method as an opt-in agent skill.
 * Emits metadata consumable by Skillgate and (later) swagger `x-hazel-skill`.
 */

import 'reflect-metadata';
import type { AgentSkillConfig, XHazelSkill } from './types';

const AGENT_SKILL_KEY = Symbol('hazel:agent-skill');
const AGENT_SKILLS_LIST_KEY = Symbol('hazel:agent-skills');

export function AgentSkill(config: AgentSkillConfig = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const methodName = String(propertyKey);
    const meta: AgentSkillConfig = {
      name: config.name ?? methodName,
      description: config.description,
      readOnly: config.readOnly,
      requiresApproval: config.requiresApproval,
      class: config.class,
      enabled: config.enabled !== false,
    };

    Reflect.defineMetadata(AGENT_SKILL_KEY, meta, target, propertyKey);

    const existing: string[] = Reflect.getMetadata(AGENT_SKILLS_LIST_KEY, target.constructor) || [];
    if (!existing.includes(methodName)) {
      existing.push(methodName);
      Reflect.defineMetadata(AGENT_SKILLS_LIST_KEY, existing, target.constructor);
    }

    return descriptor;
  };
}

export function getAgentSkillMetadata(
  target: object,
  propertyKey: string
): AgentSkillConfig | undefined {
  return Reflect.getMetadata(AGENT_SKILL_KEY, target, propertyKey);
}

export function getAgentSkillMethods(ctor: new (...args: unknown[]) => unknown): string[] {
  return Reflect.getMetadata(AGENT_SKILLS_LIST_KEY, ctor) || [];
}

export function isAgentSkill(target: object, propertyKey: string): boolean {
  const meta = getAgentSkillMetadata(target, propertyKey);
  return Boolean(meta && meta.enabled !== false);
}

/** Map decorator config → OpenAPI `x-hazel-skill` extension object. */
export function toXHazelSkill(config: AgentSkillConfig): XHazelSkill {
  return {
    enabled: config.enabled !== false,
    name: config.name,
    description: config.description,
    readOnly: config.readOnly,
    requiresApproval: config.requiresApproval,
    class: config.class,
  };
}
