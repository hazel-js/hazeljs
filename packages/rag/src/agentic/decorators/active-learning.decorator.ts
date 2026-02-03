/**
 * Active Learning Decorator
 * Learns from user feedback to improve retrieval
 */

import 'reflect-metadata';
import { FeedbackData } from '../types';

export interface ActiveLearningConfig {
  feedbackEnabled?: boolean;
  retrainThreshold?: number;
  storageKey?: string;
}

const feedbackStore = new Map<string, FeedbackData[]>();

export function ActiveLearning(config: ActiveLearningConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const results = await originalMethod.apply(this, args);

      if (!config.feedbackEnabled) {
        return results;
      }

      // Apply learned adjustments
      const adjusted = applyLearning(results, config);

      return adjusted;
    };

    return descriptor;
  };
}

export function Feedback(): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const feedbackData = args[0] as FeedbackData;

      // Store feedback
      storeFeedback(feedbackData);

      // Execute original method if any
      if (originalMethod) {
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

function applyLearning(results: unknown, config: ActiveLearningConfig): unknown {
  if (!Array.isArray(results)) {
    return results;
  }

  const storageKey = config.storageKey || 'default';
  const feedback = feedbackStore.get(storageKey) || [];

  if (feedback.length === 0) {
    return results;
  }

  // Adjust scores based on feedback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (results as any[])
    .map((result: { id?: string; score?: number }) => {
      const relevantFeedback = feedback.filter((f) => f.resultId === result.id);

      if (relevantFeedback.length === 0) {
        return result;
      }

      const avgRating =
        relevantFeedback.reduce((sum, f) => sum + f.rating, 0) / relevantFeedback.length;
      const relevanceBoost = (avgRating - 3) / 5; // Normalize to -0.4 to 0.4

      return {
        ...result,
        score: Math.max(0, Math.min(1, (result.score || 0.5) + relevanceBoost)),
        feedbackCount: relevantFeedback.length,
        avgRating,
      };
    })
    .sort((a: { score?: number }, b: { score?: number }) => (b.score || 0) - (a.score || 0));
}

function storeFeedback(feedback: FeedbackData): void {
  const storageKey = 'default';
  const existing = feedbackStore.get(storageKey) || [];

  existing.push(feedback);

  // Keep only recent feedback
  const maxFeedback = 1000;
  if (existing.length > maxFeedback) {
    existing.splice(0, existing.length - maxFeedback);
  }

  feedbackStore.set(storageKey, existing);
}

export function getFeedbackStats(storageKey: string = 'default'): {
  totalFeedback: number;
  avgRating: number;
  relevantCount: number;
} {
  const feedback = feedbackStore.get(storageKey) || [];

  if (feedback.length === 0) {
    return { totalFeedback: 0, avgRating: 0, relevantCount: 0 };
  }

  const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
  const relevantCount = feedback.filter((f) => f.relevant).length;

  return {
    totalFeedback: feedback.length,
    avgRating,
    relevantCount,
  };
}

export function clearFeedback(storageKey: string = 'default'): void {
  feedbackStore.delete(storageKey);
}
