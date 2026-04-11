import { AIEnhancedService } from '../ai-enhanced.service';
import type {
  HazelAIConfig,
  ClassifyOptions,
  ClassifyResult,
  SentimentResult,
  ScoreOptions,
  ScoreResult,
} from '../platform/hazel-ai.types';

/**
 * ML Facade — Provides high-level machine learning APIs.
 *
 * This facade implements classification, sentiment analysis, and scoring
 * using LLMs with structured output. In Phase 2, it can be extended
 * to use registered ML models from @hazeljs/ml when available.
 */
export class MLFacade {
  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Classify text into one of the provided labels.
   *
   * @param text The text to classify
   * @param options Labels and configuration
   * @returns Classification result with confidence
   */
  async classify(text: string, options: ClassifyOptions): Promise<ClassifyResult> {
    const mlPredict = this.config.ml?.predict;
    if (options.mlModel && mlPredict) {
      const raw = await mlPredict(
        options.mlModel,
        { text, labels: options.labels },
        options.mlVersion
      );
      const r = raw as {
        label?: string;
        confidence?: number;
        scores?: Record<string, number>;
      };
      if (r && typeof r === 'object' && 'label' in r && r.label) {
        return {
          label: String(r.label),
          confidence: typeof r.confidence === 'number' ? r.confidence : 1,
          allScores: r.scores,
        };
      }
    }

    const labelsStr = options.labels.join(', ');
    const multiLabel = options.multi
      ? 'You may select multiple labels.'
      : 'Select exactly one label.';

    const response = await this.aiService.complete(
      {
        messages: [
          {
            role: 'system',
            content: `You are a text classifier. ${multiLabel} Classify the given text into one of these labels: ${labelsStr}. Respond with JSON: {"label":"...","confidence":0.0}`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        responseFormat: 'json',
      },
      {
        provider: options.provider || this.config.defaultProvider,
      }
    );

    try {
      return JSON.parse(response.content) as ClassifyResult;
    } catch {
      throw new Error(`Failed to parse classification response: ${response.content}`);
    }
  }

  /**
   * Analyze sentiment of text.
   *
   * @param text The text to analyze
   * @returns Sentiment result (positive/negative/neutral with score)
   */
  async sentiment(text: string): Promise<SentimentResult> {
    const result = await this.classify(text, {
      labels: ['positive', 'negative', 'neutral'],
      provider: this.config.defaultProvider,
    });

    return {
      sentiment: result.label as 'positive' | 'negative' | 'neutral',
      score: result.confidence,
    };
  }

  /**
   * Score items against a criteria.
   *
   * @param prompt The scoring prompt/criteria
   * @param options Items to score and criteria
   * @returns Array of scores with reasoning
   */
  async score(prompt: string, options: ScoreOptions): Promise<ScoreResult[]> {
    const itemsList = options.items
      .map((item) => `- ID: ${item.id}\n  Text: ${item.text}`)
      .join('\n');

    const response = await this.aiService.complete(
      {
        messages: [
          {
            role: 'system',
            content: `You are a scoring assistant. Score each item from 0.0 to 1.0 based on the criteria: ${options.criteria}. Respond with JSON array: [{"id":"...","score":0.0,"reasoning":"..."}]`,
          },
          {
            role: 'user',
            content: `${prompt}\n\nItems:\n${itemsList}`,
          },
        ],
        temperature: 0,
        responseFormat: 'json',
      },
      {
        provider: options.provider || this.config.defaultProvider,
      }
    );

    try {
      return JSON.parse(response.content) as ScoreResult[];
    } catch {
      throw new Error(`Failed to parse scoring response: ${response.content}`);
    }
  }
}
