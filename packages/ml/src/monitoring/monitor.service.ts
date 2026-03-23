/**
 * Monitor Service - Ongoing model monitoring and alerting
 */

import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { DriftResult, DriftConfig } from './drift.types';
import { DriftService } from './drift.service';

export interface MonitorConfig {
  modelName: string;
  modelVersion?: string;
  featureDrift?: Omit<DriftConfig, 'features' | 'type'>;
  predictionDrift?: boolean;
  accuracyMonitor?: {
    threshold: number;
    windowSize: number;
  };
  alertWebhook?: string;
  checkIntervalMinutes?: number;
}

export interface MonitorAlert {
  timestamp: Date;
  modelName: string;
  modelVersion?: string;
  alertType: 'drift' | 'accuracy' | 'latency' | 'error_rate';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

export type AlertHandler = (alert: MonitorAlert) => void | Promise<void>;

@Service()
export class MonitorService {
  private driftService: DriftService;
  private monitors: Map<string, MonitorConfig> = new Map();
  private alertHandlers: AlertHandler[] = [];
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private accuracyHistory: Map<string, Array<{ timestamp: Date; accuracy: number }>> = new Map();

  constructor(driftService: DriftService) {
    this.driftService = driftService;
  }

  /**
   * Register a model for monitoring
   */
  registerModel(config: MonitorConfig): void {
    const key = this.getMonitorKey(config.modelName, config.modelVersion);
    this.monitors.set(key, config);

    // Set up periodic checks if interval specified
    if (config.checkIntervalMinutes && config.checkIntervalMinutes > 0) {
      const intervalMs = config.checkIntervalMinutes * 60 * 1000;
      const interval = setInterval(() => {
        this.checkModel(config.modelName, config.modelVersion);
      }, intervalMs);

      // Clean up old interval if exists
      const oldInterval = this.checkIntervals.get(key);
      if (oldInterval) {
        clearInterval(oldInterval);
      }
      this.checkIntervals.set(key, interval);
    }

    logger.debug(`Registered monitor for ${config.modelName}@${config.modelVersion ?? 'latest'}`);
  }

  /**
   * Unregister a model from monitoring
   */
  unregisterModel(modelName: string, modelVersion?: string): void {
    const key = this.getMonitorKey(modelName, modelVersion);
    this.monitors.delete(key);

    const interval = this.checkIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(key);
    }

    logger.debug(`Unregistered monitor for ${modelName}@${modelVersion ?? 'latest'}`);
  }

  /**
   * Add an alert handler
   */
  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Remove an alert handler
   */
  offAlert(handler: AlertHandler): void {
    const idx = this.alertHandlers.indexOf(handler);
    if (idx >= 0) {
      this.alertHandlers.splice(idx, 1);
    }
  }

  /**
   * Record prediction for drift monitoring
   */
  recordPrediction(
    modelName: string,
    features: Record<string, number>,
    prediction: number | string
  ): void {
    // This would store predictions for batch drift detection
    // In a real implementation, this would write to a time-series DB
    logger.debug(`Recorded prediction for ${modelName}`, { features, prediction });
  }

  /**
   * Record accuracy metric for accuracy monitoring
   */
  recordAccuracy(modelName: string, accuracy: number, modelVersion?: string): void {
    const key = this.getMonitorKey(modelName, modelVersion);
    const history = this.accuracyHistory.get(key) ?? [];
    history.push({ timestamp: new Date(), accuracy });
    this.accuracyHistory.set(key, history);

    // Check if accuracy dropped below threshold
    const config = this.monitors.get(key);
    if (config?.accuracyMonitor) {
      const { threshold, windowSize } = config.accuracyMonitor;
      const recent = history.slice(-windowSize);
      const avgAccuracy = recent.reduce((sum, h) => sum + h.accuracy, 0) / recent.length;

      if (avgAccuracy < threshold) {
        this.emitAlert({
          timestamp: new Date(),
          modelName,
          modelVersion,
          alertType: 'accuracy',
          severity: 'critical',
          message: `Average accuracy ${avgAccuracy.toFixed(4)} below threshold ${threshold} over last ${windowSize} checks`,
          details: { avgAccuracy, threshold, windowSize, recentHistory: recent },
        });
      }
    }
  }

  /**
   * Check a model for drift and other issues
   */
  async checkModel(modelName: string, modelVersion?: string): Promise<DriftResult[]> {
    const key = this.getMonitorKey(modelName, modelVersion);
    const config = this.monitors.get(key);
    if (!config) {
      throw new Error(`No monitor registered for ${modelName}@${modelVersion ?? 'latest'}`);
    }

    const results: DriftResult[] = [];

    // Note: In a real implementation, this would fetch recent feature data
    // from the feature store or prediction logs
    // For now, this is a placeholder for the check structure

    if (config.featureDrift) {
      // This would be populated from actual feature data
      const dummyFeatures: Record<string, number[]> = {};

      try {
        const report = this.driftService.detectDriftReport(dummyFeatures, config.featureDrift);
        results.push(...report.results);

        for (const result of report.results) {
          if (result.driftDetected) {
            this.emitAlert({
              timestamp: new Date(),
              modelName,
              modelVersion,
              alertType: 'drift',
              severity: 'warning',
              message: result.message,
              details: { feature: result.feature, score: result.score, method: result.method },
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to check drift for ${modelName}:`, error);
      }
    }

    return results;
  }

  /**
   * Get monitoring status for all registered models
   */
  getStatus(): Array<{
    modelName: string;
    modelVersion?: string;
    isActive: boolean;
    checkInterval?: number;
  }> {
    return Array.from(this.monitors.values()).map((config) => ({
      modelName: config.modelName,
      modelVersion: config.modelVersion,
      isActive: this.checkIntervals.has(this.getMonitorKey(config.modelName, config.modelVersion)),
      checkInterval: config.checkIntervalMinutes,
    }));
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    for (const [key, interval] of this.checkIntervals) {
      clearInterval(interval);
      this.checkIntervals.delete(key);
    }
    logger.debug('Stopped all monitoring');
  }

  private getMonitorKey(modelName: string, modelVersion?: string): string {
    return modelVersion ? `${modelName}:${modelVersion}` : modelName;
  }

  private async emitAlert(alert: MonitorAlert): Promise<void> {
    for (const handler of this.alertHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        logger.error('Alert handler failed:', error);
      }
    }
  }
}
