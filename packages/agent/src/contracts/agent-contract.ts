/**
 * Agent OS Phase 2 — Agent Contracts (I/O, SLO, fallbacks)
 */

import type { AgentExecutionResult } from '../types/agent.types';

export type ContractCheckKind = 'input' | 'output' | 'latency' | 'cost' | 'tools' | 'custom';

export interface AgentContract {
  name: string;
  /** Substring or regex that input must match (optional). */
  inputIncludes?: string | RegExp;
  /** Substring or regex that output must match (optional). */
  outputIncludes?: string | RegExp;
  maxLatencyMs?: number;
  maxCostUsd?: number;
  /** Tool names that must appear (order-insensitive). */
  requiredTools?: string[];
  /** Tool names that must not appear. */
  forbiddenTools?: string[];
  /** Agent to run if this contract fails. */
  fallbackAgent?: string;
  /** Custom predicate — return true if ok. */
  custom?: (result: AgentExecutionResult, input: string) => boolean | Promise<boolean>;
}

export interface ContractViolation {
  kind: ContractCheckKind;
  message: string;
}

export interface ContractValidationResult {
  ok: boolean;
  contract: string;
  violations: ContractViolation[];
  fallbackAgent?: string;
}

function includesMatch(haystack: string, needle: string | RegExp): boolean {
  if (typeof needle === 'string') return haystack.toLowerCase().includes(needle.toLowerCase());
  return needle.test(haystack);
}

function toolNames(result: AgentExecutionResult): string[] {
  return result.steps
    .filter((s) => s.action?.toolName)
    .map((s) => s.action!.toolName!)
    .concat(result.steps.flatMap((s) => s.action?.toolCalls?.map((t) => t.toolName) ?? []));
}

export async function validateAgentContract(
  contract: AgentContract,
  input: string,
  result: AgentExecutionResult,
  costUsd?: number
): Promise<ContractValidationResult> {
  const violations: ContractViolation[] = [];

  if (contract.inputIncludes && !includesMatch(input, contract.inputIncludes)) {
    violations.push({ kind: 'input', message: 'Input did not match contract.inputIncludes' });
  }

  const output = result.response ?? '';
  if (contract.outputIncludes && !includesMatch(output, contract.outputIncludes)) {
    violations.push({ kind: 'output', message: 'Output did not match contract.outputIncludes' });
  }

  if (contract.maxLatencyMs != null && result.duration > contract.maxLatencyMs) {
    violations.push({
      kind: 'latency',
      message: `Latency ${result.duration}ms exceeded maxLatencyMs ${contract.maxLatencyMs}`,
    });
  }

  if (contract.maxCostUsd != null && costUsd != null && costUsd > contract.maxCostUsd) {
    violations.push({
      kind: 'cost',
      message: `Cost $${costUsd} exceeded maxCostUsd $${contract.maxCostUsd}`,
    });
  }

  const tools = toolNames(result);
  if (contract.requiredTools?.length) {
    for (const t of contract.requiredTools) {
      if (!tools.includes(t)) {
        violations.push({ kind: 'tools', message: `Required tool missing: ${t}` });
      }
    }
  }
  if (contract.forbiddenTools?.length) {
    for (const t of contract.forbiddenTools) {
      if (tools.includes(t)) {
        violations.push({ kind: 'tools', message: `Forbidden tool used: ${t}` });
      }
    }
  }

  if (contract.custom) {
    const ok = await contract.custom(result, input);
    if (!ok) violations.push({ kind: 'custom', message: 'Custom contract predicate failed' });
  }

  return {
    ok: violations.length === 0,
    contract: contract.name,
    violations,
    fallbackAgent: contract.fallbackAgent,
  };
}

/** Run primary agent; on contract failure, optionally run fallbackAgent via provided execute. */
export async function executeWithContract<T extends AgentExecutionResult>(opts: {
  contract: AgentContract;
  input: string;
  execute: (agentName: string, input: string) => Promise<T>;
  primaryAgent: string;
  costUsd?: number;
}): Promise<{ result: T; validation: ContractValidationResult; usedFallback: boolean }> {
  const result = await opts.execute(opts.primaryAgent, opts.input);
  let validation = await validateAgentContract(opts.contract, opts.input, result, opts.costUsd);

  if (!validation.ok && validation.fallbackAgent) {
    const fallback = await opts.execute(validation.fallbackAgent, opts.input);
    validation = await validateAgentContract(opts.contract, opts.input, fallback, opts.costUsd);
    return { result: fallback, validation, usedFallback: true };
  }

  return { result, validation, usedFallback: false };
}
