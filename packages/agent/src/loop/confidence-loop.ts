/**
 * Agent OS Confidence Loop Engine
 * Outer loop: plan → execute → critique → validate until successScore or maxIterations.
 */

import {
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentLoopOptions,
  AgentLoopStage,
  AgentState,
} from '../types/agent.types';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import { IAgentStateManager } from '../state/agent-state.interface';

const DEFAULT_STAGES: AgentLoopStage[] = ['plan', 'execute', 'critique', 'validate'];

export interface ConfidenceLoopDeps {
  agentName: string;
  input: string;
  options: AgentExecutionOptions;
  executeOnce: (
    agentName: string,
    input: string,
    options: AgentExecutionOptions
  ) => Promise<AgentExecutionResult>;
  llmProvider?: LLMProvider;
  stateManager: IAgentStateManager;
  emit: (
    type: AgentEventType,
    agentId: string,
    executionId: string,
    data: unknown
  ) => void | Promise<void>;
}

function parseScore(text: string): { score: number; feedback: string } {
  const scoreMatch = text.match(/score\s*[:=]\s*(\d{1,3})/i) ?? text.match(/\b(\d{1,3})\s*\/\s*100\b/);
  let score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 50;
  const feedbackMatch = text.match(/feedback\s*[:=]\s*([\s\S]+)/i);
  const feedback = feedbackMatch ? feedbackMatch[1].trim() : text.trim();
  if (!scoreMatch && /pass|success|complete/i.test(text) && !/fail|incomplete/i.test(text)) {
    score = 90;
  }
  return { score, feedback };
}

async function llmText(
  llm: LLMProvider | undefined,
  system: string,
  user: string
): Promise<string> {
  if (!llm) {
    // Without LLM, only pass soft thresholds — never auto-pass high bars like 95
    return 'score: 70\nfeedback: No LLM available; heuristic soft pass.';
  }
  const result = await llm.chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return result.content ?? '';
}

async function setState(
  deps: ConfidenceLoopDeps,
  executionId: string | undefined,
  state: AgentState
): Promise<void> {
  if (!executionId) return;
  await deps.stateManager.updateState(executionId, state);
}

export async function runConfidenceLoop(deps: ConfidenceLoopDeps): Promise<AgentExecutionResult> {
  const loopOpts: AgentLoopOptions = deps.options.loop ?? {};
  const maxIterations = loopOpts.maxIterations ?? 5;
  const successScore = loopOpts.successScore ?? 95;
  const stages = loopOpts.stages?.length ? loopOpts.stages : DEFAULT_STAGES;

  const { loop: _loop, ...baseOptions } = deps.options;
  void _loop;

  let lastResult: AgentExecutionResult | undefined;
  let plan = '';
  let critiqueFeedback = '';
  let finalScore = 0;
  let iteration = 0;
  const startTime = Date.now();

  for (iteration = 1; iteration <= maxIterations; iteration++) {
    if (stages.includes('plan')) {
      await setState(deps, lastResult?.executionId, AgentState.PLANNING);
      const planPrompt = critiqueFeedback
        ? `Improve the plan for the goal based on this critique:\n${critiqueFeedback}\n\nGoal: ${deps.input}`
        : `Create a concise step-by-step plan to achieve this goal:\n${deps.input}`;
      plan = await llmText(
        deps.llmProvider,
        'You are a planning assistant. Output only the plan as a numbered list.',
        planPrompt
      );
      await deps.emit(AgentEventType.LOOP_ITERATION, deps.agentName, lastResult?.executionId ?? '', {
        iteration,
        maxIterations,
        stage: 'plan',
        plan,
      });
    }

    if (stages.includes('execute')) {
      const goalWithPlan = plan
        ? `Goal: ${deps.input}\n\nPlan:\n${plan}\n\nExecute the plan and produce the final answer.`
        : deps.input;
      lastResult = await deps.executeOnce(deps.agentName, goalWithPlan, {
        ...baseOptions,
        metadata: {
          ...baseOptions.metadata,
          loopIteration: iteration,
          loopPlan: plan,
          loopStage: 'execute',
        },
      });

      // First iteration now has executionId — mark planning was intended if we planned first
      if (stages.includes('plan') && iteration === 1 && lastResult.executionId) {
        await deps.emit(AgentEventType.LOOP_ITERATION, deps.agentName, lastResult.executionId, {
          iteration,
          stage: 'plan_bound',
          plan,
        });
      }

      if (
        lastResult.state === AgentState.WAITING_FOR_APPROVAL ||
        lastResult.state === AgentState.WAITING_FOR_INPUT
      ) {
        return {
          ...lastResult,
          loop: { iterations: iteration, finalScore, success: false },
        };
      }

      if (lastResult.state === AgentState.FAILED) {
        critiqueFeedback = lastResult.error?.message ?? 'Execution failed';
        finalScore = 0;
        await deps.emit(AgentEventType.LOOP_CRITIQUE, deps.agentName, lastResult.executionId, {
          iteration,
          score: 0,
          feedback: critiqueFeedback,
          successScore,
        });
        continue;
      }
    }

    let critiqueScore = finalScore;
    let validateScore = finalScore;

    if (stages.includes('critique')) {
      await setState(deps, lastResult?.executionId, AgentState.VALIDATING);
      const response = lastResult?.response ?? '';
      const critiqueRaw = await llmText(
        deps.llmProvider,
        `You critique agent answers. Reply with:\nscore: <0-100>\nfeedback: <what to improve>`,
        `Goal: ${deps.input}\nPlan: ${plan}\nAnswer: ${response}\nRequired success score: ${successScore}`
      );
      const parsed = parseScore(critiqueRaw);
      critiqueScore = parsed.score;
      critiqueFeedback = parsed.feedback;
      await deps.emit(AgentEventType.LOOP_CRITIQUE, deps.agentName, lastResult?.executionId ?? '', {
        iteration,
        stage: 'critique',
        score: critiqueScore,
        feedback: critiqueFeedback,
        successScore,
      });
    }

    if (stages.includes('validate')) {
      await setState(deps, lastResult?.executionId, AgentState.VALIDATING);
      const response = lastResult?.response ?? '';
      const validateRaw = await llmText(
        deps.llmProvider,
        `You validate whether the answer fully satisfies the goal. Reply with:\nscore: <0-100>\nfeedback: <gaps or PASS>`,
        `Goal: ${deps.input}\nAnswer: ${response}\nCritique notes: ${critiqueFeedback}\nRequired success score: ${successScore}`
      );
      const parsed = parseScore(validateRaw);
      validateScore = parsed.score;
      if (parsed.feedback) critiqueFeedback = parsed.feedback;
      await deps.emit(AgentEventType.LOOP_CRITIQUE, deps.agentName, lastResult?.executionId ?? '', {
        iteration,
        stage: 'validate',
        score: validateScore,
        feedback: critiqueFeedback,
        successScore,
      });
    }

    if (stages.includes('critique') || stages.includes('validate')) {
      const scores: number[] = [];
      if (stages.includes('critique')) scores.push(critiqueScore);
      if (stages.includes('validate')) scores.push(validateScore);
      finalScore = scores.length ? Math.min(...scores) : 0;
      if (finalScore >= successScore) break;
    } else {
      finalScore = successScore;
      break;
    }
  }

  const success = finalScore >= successScore;
  const result: AgentExecutionResult = lastResult ?? {
    executionId: '',
    agentId: deps.agentName,
    state: AgentState.FAILED,
    steps: [],
    metadata: {},
    duration: Date.now() - startTime,
    completedAt: new Date(),
    error: new Error('Loop completed without execution'),
  };

  await deps.emit(AgentEventType.LOOP_COMPLETE, deps.agentName, result.executionId, {
    iterations: iteration,
    finalScore,
    success,
    response: result.response,
  });

  return {
    ...result,
    state: success
      ? AgentState.COMPLETED
      : result.state === AgentState.FAILED
        ? AgentState.FAILED
        : AgentState.FAILED,
    duration: Date.now() - startTime,
    loop: {
      iterations: Math.min(iteration, maxIterations),
      finalScore,
      success,
    },
    metadata: {
      ...result.metadata,
      loopFinalScore: finalScore,
      loopSuccess: success,
    },
    error: success
      ? result.error
      : result.error ?? new Error(`Loop did not reach successScore ${successScore} (got ${finalScore})`),
  };
}
