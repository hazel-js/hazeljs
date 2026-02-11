/**
 * Decision ruleset DSL
 */

export interface Condition {
  path: string;
  eq?: unknown;
  ne?: unknown;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  exists?: boolean;
  contains?: string;
}

export interface DecisionRule {
  when?: Condition;
  reason?: string;
  status?: string;
}

export interface DecisionRuleset {
  rules: DecisionRule[];
  defaultStatus?: string;
}
