/**
 * Enrich an OpenAPI-like document with `@AgentSkill` metadata from controllers.
 */

import {
  getAgentSkillMetadata,
  getAgentSkillMethods,
  toXHazelSkill,
} from './agent-skill.decorator';
import type { OpenApiLike, OpenApiOperation } from './types';

type ControllerCtor = new (...args: unknown[]) => unknown;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

/**
 * For each `@AgentSkill` method, patch matching operations (by operationId or
 * method name) with `x-hazel-skill`.
 */
export function enrichSpecWithAgentSkills(
  spec: OpenApiLike,
  controllers: ControllerCtor[]
): OpenApiLike {
  const paths = spec.paths ?? {};

  for (const Controller of controllers) {
    const proto = Controller.prototype as object;
    const methods = getAgentSkillMethods(Controller);

    for (const methodName of methods) {
      const meta = getAgentSkillMetadata(proto, methodName);
      if (!meta || meta.enabled === false) continue;

      const xSkill = toXHazelSkill(meta);

      for (const pathItem of Object.values(paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;
        for (const [httpMethod, raw] of Object.entries(pathItem)) {
          if (!HTTP_METHODS.has(httpMethod.toLowerCase())) continue;
          if (!raw || typeof raw !== 'object') continue;
          const op = raw as OpenApiOperation;
          const opId = op.operationId ?? '';
          if (opId === methodName || opId === meta.name) {
            op['x-hazel-skill'] = {
              ...xSkill,
              ...(typeof op['x-hazel-skill'] === 'object' ? op['x-hazel-skill'] : {}),
            };
          }
        }
      }
    }
  }

  return spec;
}
