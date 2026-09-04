import {
  DiagnosisResult,
  ErrorCategory,
  HealingStrategyName,
  AIDiagnosticsProvider,
} from '../types';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

const CONFIG_CODES = new Set(['EINVAL', 'ENOENT', 'EACCES', 'EPERM']);

const MEMORY_PATTERNS = [
  /out of memory/i,
  /heap out of memory/i,
  /allocation failed/i,
  /cannot allocate/i,
];

const TIMEOUT_PATTERNS = [/timeout/i, /timed out/i, /deadline exceeded/i];

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildDiagnosis(
  category: ErrorCategory,
  confidence: number,
  message: string,
  suggestedStrategies: HealingStrategyName[],
  metadata?: Record<string, unknown>
): DiagnosisResult {
  return { category, confidence, message, suggestedStrategies, metadata };
}

/**
 * Rule-based error diagnostician with optional AI provider hook.
 */
export class ErrorDiagnostician {
  constructor(private readonly aiProvider?: AIDiagnosticsProvider) {}

  async diagnose(error: unknown, context: Record<string, unknown> = {}): Promise<DiagnosisResult> {
    if (this.aiProvider) {
      const aiResult = await this.aiProvider.diagnose(error, context);
      if (aiResult) {
        return aiResult;
      }
    }

    return this.ruleBasedDiagnose(error);
  }

  ruleBasedDiagnose(error: unknown): DiagnosisResult {
    const code = getErrorCode(error);
    const message = getErrorMessage(error);

    if (code && CONNECTION_CODES.has(code)) {
      return buildDiagnosis('dependency', 0.9, `Dependency unavailable (${code}): ${message}`, [
        'auto-restart',
        'safe-mode',
      ]);
    }

    if (code && CONFIG_CODES.has(code)) {
      return buildDiagnosis('config', 0.85, `Configuration issue (${code}): ${message}`, [
        'config-rollback',
        'safe-mode',
      ]);
    }

    if (MEMORY_PATTERNS.some((pattern) => pattern.test(message))) {
      return buildDiagnosis('memory', 0.95, `Memory pressure detected: ${message}`, [
        'memory-cleanup',
        'auto-restart',
      ]);
    }

    if (TIMEOUT_PATTERNS.some((pattern) => pattern.test(message))) {
      return buildDiagnosis('timeout', 0.8, `Timeout detected: ${message}`, [
        'auto-restart',
        'config-rollback',
      ]);
    }

    if (/slow|degraded|latency/i.test(message)) {
      return buildDiagnosis('performance', 0.7, `Performance degradation: ${message}`, [
        'hpa-boost',
        'auto-restart',
        'memory-cleanup',
      ]);
    }

    return buildDiagnosis('unknown', 0.4, `Unclassified error: ${message}`, [
      'auto-restart',
      'safe-mode',
    ]);
  }
}
