import {
  AIDiagnosticsProvider,
  DiagnosisResult,
  ErrorCategory,
  HealingStrategyName,
} from '../types';

export interface AILlmClient {
  complete(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { model?: string; temperature?: number }
  ): Promise<string>;
}

const VALID_CATEGORIES: ErrorCategory[] = [
  'dependency',
  'config',
  'memory',
  'timeout',
  'performance',
  'unknown',
];

const VALID_STRATEGIES: HealingStrategyName[] = [
  'auto-restart',
  'config-rollback',
  'memory-cleanup',
  'safe-mode',
  'pod-restart',
  'hpa-boost',
];

const SYSTEM_PROMPT = `You are a microservices SRE assistant. Diagnose runtime errors and suggest recovery strategies.
Respond with JSON only:
{
  "category": "dependency|config|memory|timeout|performance|unknown",
  "confidence": 0.0-1.0,
  "message": "short diagnosis",
  "suggestedStrategies": ["auto-restart","config-rollback","memory-cleanup","safe-mode","pod-restart","hpa-boost"]
}`;

function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === 'string' && VALID_CATEGORIES.includes(value as ErrorCategory);
}

function isHealingStrategy(value: unknown): value is HealingStrategyName {
  return typeof value === 'string' && VALID_STRATEGIES.includes(value as HealingStrategyName);
}

function parseDiagnosisJson(raw: string): DiagnosisResult | null {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!isErrorCategory(parsed.category)) {
      return null;
    }
    if (typeof parsed.message !== 'string') {
      return null;
    }

    const confidence =
      typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

    const suggestedStrategies = Array.isArray(parsed.suggestedStrategies)
      ? parsed.suggestedStrategies.filter(isHealingStrategy)
      : [];

    return {
      category: parsed.category,
      confidence,
      message: parsed.message,
      suggestedStrategies:
        suggestedStrategies.length > 0 ? suggestedStrategies : ['auto-restart', 'safe-mode'],
      metadata: { source: 'ai' },
    };
  } catch {
    return null;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code =
      'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;
    return code ? `${code}: ${error.message}` : error.message;
  }
  return String(error);
}

/**
 * Create an AI diagnostics provider from any LLM client that returns text completions.
 */
export function createAIDiagnosticsProvider(
  client: AILlmClient,
  options: { model?: string } = {}
): AIDiagnosticsProvider {
  return {
    async diagnose(
      error: unknown,
      context: Record<string, unknown>
    ): Promise<DiagnosisResult | null> {
      const prompt = [
        `Target: ${String(context.target ?? 'unknown')}`,
        `Attempt: ${String(context.attempt ?? 1)}`,
        `Error: ${formatError(error)}`,
        `Context: ${JSON.stringify(context)}`,
      ].join('\n');

      const content = await client.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        { model: options.model, temperature: 0.1 }
      );

      return parseDiagnosisJson(content);
    },
  };
}

export { parseDiagnosisJson };
