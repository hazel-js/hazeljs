import { TokenUsage, TokenLimitConfig } from '../ai-enhanced.types';
import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';

/**
 * Token Usage Tracker
 * Tracks and limits token usage per user/request
 */
@Injectable()
export class TokenTracker {
  private usageHistory: TokenUsage[] = [];
  private config: TokenLimitConfig;
  private userUsage: Map<string, TokenUsage[]> = new Map();

  // Token costs per 1K tokens (as of 2024)
  private readonly TOKEN_COSTS: Record<string, { prompt: number; completion: number }> = {
    'gpt-4-turbo-preview': { prompt: 0.01, completion: 0.03 },
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
    'claude-3-opus': { prompt: 0.015, completion: 0.075 },
    'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
    'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
  };

  constructor(config?: TokenLimitConfig) {
    this.config = {
      maxTokensPerRequest: config?.maxTokensPerRequest || 4096,
      maxTokensPerDay: config?.maxTokensPerDay || 100000,
      maxTokensPerMonth: config?.maxTokensPerMonth || 1000000,
      costPerToken: config?.costPerToken,
    };
    logger.info('Token Tracker initialized', this.config);
  }

  /**
   * Track token usage
   */
  track(usage: TokenUsage, model?: string): void {
    // Calculate cost if not provided
    if (!usage.cost && model) {
      usage.cost = this.calculateCost(usage, model);
    }

    this.usageHistory.push(usage);

    // Track per user if userId provided
    if (usage.userId) {
      const userHistory = this.userUsage.get(usage.userId) || [];
      userHistory.push(usage);
      this.userUsage.set(usage.userId, userHistory);
    }

    logger.debug('Token usage tracked', {
      userId: usage.userId,
      totalTokens: usage.totalTokens,
      cost: usage.cost,
    });
  }

  /**
   * Check if request is within limits
   */
  async checkLimits(
    userId?: string,
    requestTokens?: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
    usage?: {
      today: number;
      month: number;
      limit: {
        daily: number;
        monthly: number;
      };
    };
  }> {
    // Check request token limit
    if (requestTokens && requestTokens > this.config.maxTokensPerRequest!) {
      return {
        allowed: false,
        reason: `Request exceeds token limit (${requestTokens} > ${this.config.maxTokensPerRequest})`,
      };
    }

    if (!userId) {
      return { allowed: true };
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const userHistory = this.userUsage.get(userId) || [];

    // Calculate daily usage
    const dailyUsage = userHistory
      .filter((u) => u.timestamp > oneDayAgo)
      .reduce((sum, u) => sum + u.totalTokens, 0);

    // Calculate monthly usage
    const monthlyUsage = userHistory
      .filter((u) => u.timestamp > oneMonthAgo)
      .reduce((sum, u) => sum + u.totalTokens, 0);

    const usage = {
      today: dailyUsage,
      month: monthlyUsage,
      limit: {
        daily: this.config.maxTokensPerDay!,
        monthly: this.config.maxTokensPerMonth!,
      },
    };

    // Check daily limit
    if (dailyUsage >= this.config.maxTokensPerDay!) {
      return {
        allowed: false,
        reason: 'Daily token limit exceeded',
        usage,
      };
    }

    // Check monthly limit
    if (monthlyUsage >= this.config.maxTokensPerMonth!) {
      return {
        allowed: false,
        reason: 'Monthly token limit exceeded',
        usage,
      };
    }

    return { allowed: true, usage };
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(usage: TokenUsage, model: string): number {
    const costs = this.TOKEN_COSTS[model];
    if (!costs) {
      logger.warn(`Unknown model for cost calculation: ${model}`);
      return 0;
    }

    const promptCost = (usage.promptTokens / 1000) * costs.prompt;
    const completionCost = (usage.completionTokens / 1000) * costs.completion;

    return promptCost + completionCost;
  }

  /**
   * Get usage statistics for a user
   */
  getUserStats(
    userId: string,
    days: number = 30
  ): {
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    averageTokensPerRequest: number;
    dailyAverage: number;
  } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const userHistory = (this.userUsage.get(userId) || []).filter((u) => u.timestamp > cutoff);

    const totalTokens = userHistory.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCost = userHistory.reduce((sum, u) => sum + (u.cost || 0), 0);
    const requestCount = userHistory.length;

    return {
      totalTokens,
      totalCost,
      requestCount,
      averageTokensPerRequest: requestCount > 0 ? Math.round(totalTokens / requestCount) : 0,
      dailyAverage: Math.round(totalTokens / days),
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(days: number = 30): {
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    uniqueUsers: number;
    topUsers: Array<{ userId: string; tokens: number; cost: number }>;
  } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recentUsage = this.usageHistory.filter((u) => u.timestamp > cutoff);

    const totalTokens = recentUsage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCost = recentUsage.reduce((sum, u) => sum + (u.cost || 0), 0);
    const requestCount = recentUsage.length;

    // Calculate per-user stats
    const userStats = new Map<string, { tokens: number; cost: number }>();
    recentUsage.forEach((u) => {
      if (u.userId) {
        const stats = userStats.get(u.userId) || { tokens: 0, cost: 0 };
        stats.tokens += u.totalTokens;
        stats.cost += u.cost || 0;
        userStats.set(u.userId, stats);
      }
    });

    // Get top users
    const topUsers = Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        userId,
        tokens: stats.tokens,
        cost: stats.cost,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);

    return {
      totalTokens,
      totalCost,
      requestCount,
      uniqueUsers: userStats.size,
      topUsers,
    };
  }

  /**
   * Clear old usage data
   */
  cleanup(daysToKeep: number = 90): void {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    // Clean global history
    this.usageHistory = this.usageHistory.filter((u) => u.timestamp > cutoff);

    // Clean per-user history
    for (const [userId, history] of this.userUsage.entries()) {
      const filtered = history.filter((u) => u.timestamp > cutoff);
      if (filtered.length === 0) {
        this.userUsage.delete(userId);
      } else {
        this.userUsage.set(userId, filtered);
      }
    }

    logger.info(`Cleaned up usage data older than ${daysToKeep} days`);
  }

  /**
   * Export usage data
   */
  exportData(userId?: string): TokenUsage[] {
    if (userId) {
      return this.userUsage.get(userId) || [];
    }
    return [...this.usageHistory];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TokenLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Token tracker configuration updated', this.config);
  }
}
