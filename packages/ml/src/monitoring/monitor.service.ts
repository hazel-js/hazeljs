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
  /** Feature names to monitor for drift (required when featureDrift is set) */
  featureNames?: string[];
  predictionDrift?: boolean;
  accuracyMonitor?: {
    threshold: number;
    windowSize: number;
  };
  alertWebhook?: string;
  checkIntervalMinutes?: number;
  /** Max prediction records retained for drift windows */
  maxWindowSize?: number;
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

interface PredictionRecord {
  timestamp: Date;
  features: Record<string, number>;
  prediction: number | string;
}

@Service()
export class MonitorService {
  private driftService: DriftService;
  private monitors: Map<string, MonitorConfig> = new Map();
  private alertHandlers: AlertHandler[] = [];
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private accuracyHistory: Map<string, Array<{ timestamp: Date; accuracy: number }>> = new Map();
  private predictionWindows: Map<string, PredictionRecord[]> = new Map();

  constructor(driftService: DriftService) {
    this.driftService = driftService;
  }

  /**
   * Register a model for monitoring
   */
  registerModel(config: MonitorConfig): void {
    const key = this.getMonitorKey(config.modelName, config.modelVersion);
    this.monitors.set(key, config);

    if (config.checkIntervalMinutes && config.checkIntervalMinutes > 0) {
      const intervalMs = config.checkIntervalMinutes * 60 * 1000;
      const interval = setInterval(() => {
        void this.checkModel(config.modelName, config.modelVersion);
      }, intervalMs);

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

  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  offAlert(handler: AlertHandler): void {
    const idx = this.alertHandlers.indexOf(handler);
    if (idx >= 0) {
      this.alertHandlers.splice(idx, 1);
    }
  }

  /**
   * Record prediction for drift monitoring (stored in an in-memory window).
   */
  recordPrediction(
    modelName: string,
    features: Record<string, number>,
    prediction: number | string,
    modelVersion?: string
  ): void {
    const key = this.getMonitorKey(modelName, modelVersion);
    const config = this.monitors.get(key);
    const maxWindow = config?.maxWindowSize ?? config?.featureDrift?.windowSize ?? 1000;
    const window = this.predictionWindows.get(key) ?? [];
    window.push({ timestamp: new Date(), features, prediction });
    if (window.length > maxWindow) {
      window.splice(0, window.length - maxWindow);
    }
    this.predictionWindows.set(key, window);
    logger.debug(`Recorded prediction for ${modelName}`, { features, prediction });
  }

  /**
   * Seed reference feature distributions from training data.
   */
  setReferenceFeatures(
    modelName: string,
    features: Record<string, number[]>,
    modelVersion?: string
  ): void {
    for (const [name, values] of Object.entries(features)) {
      this.driftService.setReferenceDistribution(`${modelName}:${name}`, values);
    }
    const key = this.getMonitorKey(modelName, modelVersion);
    logger.debug(`Set reference features for ${key}`, { features: Object.keys(features) });
  }

  recordAccuracy(modelName: string, accuracy: number, modelVersion?: string): void {
    const key = this.getMonitorKey(modelName, modelVersion);
    const history = this.accuracyHistory.get(key) ?? [];
    history.push({ timestamp: new Date(), accuracy });
    this.accuracyHistory.set(key, history);

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
   * Check a model for drift using recorded prediction windows.
   */
  async checkModel(modelName: string, modelVersion?: string): Promise<DriftResult[]> {
    const key = this.getMonitorKey(modelName, modelVersion);
    const config = this.monitors.get(key);
    if (!config) {
      throw new Error(`No monitor registered for ${modelName}@${modelVersion ?? 'latest'}`);
    }

    const results: DriftResult[] = [];
    const window = this.predictionWindows.get(key) ?? [];

    if (config.featureDrift && window.length > 0) {
      const featureNames =
        config.featureNames ?? (window[0] ? Object.keys(window[0].features) : []);

      const currentFeatures: Record<string, number[]> = {};
      for (const name of featureNames) {
        const scoped = `${modelName}:${name}`;
        const ref =
          this.driftService.getReferenceDistribution(scoped) ??
          this.driftService.getReferenceDistribution(name);
        if (ref) {
          this.driftService.setReferenceDistribution(name, ref);
        }
        currentFeatures[name] = window
          .map((r) => r.features[name])
          .filter((v): v is number => typeof v === 'number');
      }

      try {
        const report = this.driftService.detectDriftReport(currentFeatures, config.featureDrift);
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
            await this.postWebhook(config, result);
          }
        }
      } catch (error) {
        logger.warn(`Failed to check drift for ${modelName}:`, error);
      }
    }

    if (config.predictionDrift && window.length > 0) {
      const preds = window.map((r) => r.prediction);
      const mid = Math.floor(preds.length / 2);
      if (mid > 0) {
        const result = this.driftService.detectPredictionDrift(
          preds.slice(0, mid) as number[] | string[],
          preds.slice(mid) as number[] | string[]
        );
        results.push(result);
        if (result.driftDetected) {
          this.emitAlert({
            timestamp: new Date(),
            modelName,
            modelVersion,
            alertType: 'drift',
            severity: 'warning',
            message: result.message,
            details: { score: result.score, method: result.method },
          });
          await this.postWebhook(config, result);
        }
      }
    }

    return results;
  }

  getStatus(): Array<{
    modelName: string;
    modelVersion?: string;
    isActive: boolean;
    checkInterval?: number;
    windowSize: number;
  }> {
    return Array.from(this.monitors.entries()).map(([key, config]) => ({
      modelName: config.modelName,
      modelVersion: config.modelVersion,
      isActive: this.checkIntervals.has(key),
      checkInterval: config.checkIntervalMinutes,
      windowSize: this.predictionWindows.get(key)?.length ?? 0,
    }));
  }

  stop(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
  }

  private getMonitorKey(modelName: string, modelVersion?: string): string {
    return modelVersion ? `${modelName}@${modelVersion}` : modelName;
  }

  private emitAlert(alert: MonitorAlert): void {
    for (const handler of this.alertHandlers) {
      try {
        const result = handler(alert);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch((err) => {
            logger.warn('Alert handler failed', err);
          });
        }
      } catch (err) {
        logger.warn('Alert handler failed', err);
      }
    }
  }

  private async postWebhook(config: MonitorConfig, result: DriftResult): Promise<void> {
    if (!config.alertWebhook) return;
    try {
      await fetch(config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: config.modelName,
          modelVersion: config.modelVersion,
          alert: result,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.warn(`Webhook alert failed for ${config.modelName}:`, err);
    }
  }
}
