/**
 * @hazeljs/skillgate
 *
 * Turn OpenAPI / HazelJS REST surfaces into curated, governed agent skills.
 */

export { Skillgate } from './skillgate';
export {
  AgentSkill,
  getAgentSkillMetadata,
  getAgentSkillMethods,
  isAgentSkill,
  toXHazelSkill,
} from './agent-skill.decorator';
export { parseOpenApiOperations } from './parse-openapi';
export { matchesInclude, isDenied, DEFAULT_OPT_IN_TAGS } from './filter';
export {
  classifyOperation,
  DEFAULT_READ,
  DEFAULT_WRITE,
  DEFAULT_DESTRUCTIVE,
  DEFAULT_ADMIN_PATHS,
} from './classify';
export { assertSafeBaseUrl } from './ssrf';
export { SkillgateError, SkillgateConfigError, SkillgateSsrfError } from './errors';
export { enrichSpecWithAgentSkills } from './enrich-agent-skills';
export { defaultSkillgateOptions, SKILLGATE_DEFAULT_CLASSIFY } from './defaults';
export type {
  AgentSkillConfig,
  GovernedSkill,
  HttpMethod,
  OpenApiLike,
  OpenApiOperation,
  ParsedOperation,
  SkillClass,
  SkillgateClassifyOptions,
  SkillgateFromModuleOptions,
  SkillgateIncludeOptions,
  SkillgateInvokeOptions,
  SkillgateMcpOptions,
  SkillgateOptions,
  SkillgateReport,
  SkillParameter,
  XHazelSkill,
} from './types';
