import { HealingActionResult, HealingContext, HealingStrategyName } from '../../types';
import { drainBeforeAction } from '../../drain/graceful-drain';

export interface HealingStrategy {
  readonly name: HealingStrategyName;
  execute(context: HealingContext): Promise<HealingActionResult>;
}

export class AutoRestartStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'auto-restart';

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const instance = context.instance;
    if (instance && typeof instance.onModuleDestroy === 'function') {
      await instance.onModuleDestroy();
    }
    if (instance && typeof instance.onModuleInit === 'function') {
      await instance.onModuleInit();
    }

    return {
      strategy: this.name,
      success: true,
      message: `Restarted lifecycle hooks for ${context.target}`,
    };
  }
}

export class ConfigRollbackStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'config-rollback';

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const store = context.configStore;
    if (!store) {
      return {
        strategy: this.name,
        success: false,
        message: 'No config snapshot store configured',
      };
    }

    const rolledBack = store.rollback();
    if (!rolledBack) {
      return {
        strategy: this.name,
        success: false,
        message: 'No config snapshot available to rollback',
      };
    }

    context.onNotify?.('auto-rollback', {
      target: context.target,
      snapshotId: rolledBack.id,
      label: rolledBack.label,
    });

    return {
      strategy: this.name,
      success: true,
      message: `Rolled back config to snapshot ${rolledBack.id}`,
      rolledBack: true,
    };
  }
}

export class MemoryCleanupStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'memory-cleanup';

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const instance = context.instance;
    let cleaned = false;

    if (instance && typeof instance.clearCache === 'function') {
      await instance.clearCache();
      cleaned = true;
    }

    if (typeof global.gc === 'function') {
      global.gc();
      cleaned = true;
    }

    return {
      strategy: this.name,
      success: cleaned,
      message: cleaned
        ? `Memory cleanup executed for ${context.target}`
        : `No cleanup hooks available for ${context.target}`,
    };
  }
}

export class SafeModeStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'safe-mode';

  constructor(private readonly fallbackMethod?: string) {}

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const instance = context.instance;
    const fallbackName = this.fallbackMethod;

    if (!instance || !fallbackName) {
      return {
        strategy: this.name,
        success: false,
        message: 'Safe mode fallback method not configured',
      };
    }

    const fallback = instance[fallbackName];
    if (typeof fallback !== 'function') {
      return {
        strategy: this.name,
        success: false,
        message: `Fallback method "${fallbackName}" not found on ${context.target}`,
      };
    }

    context.onNotify?.('safe-mode-activated', {
      target: context.target,
      fallback: fallbackName,
    });

    await fallback.apply(instance, context.args ?? []);

    return {
      strategy: this.name,
      success: true,
      message: `Activated safe mode via ${fallbackName}`,
    };
  }
}

export class PodRestartStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'pod-restart';

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const k8s = context.kubernetes;
    if (!k8s?.client || !k8s.deployment) {
      return {
        strategy: this.name,
        success: false,
        message: 'Kubernetes restart client or deployment not configured',
      };
    }

    const namespace = k8s.namespace ?? 'default';
    const drainEnabled = k8s.drainBeforeRestart !== false;

    try {
      if (context.drain && drainEnabled) {
        const drainOptions =
          typeof k8s.drainBeforeRestart === 'object' ? k8s.drainBeforeRestart : undefined;
        const drainResult = await drainBeforeAction(context.drain, drainOptions, (payload) =>
          context.onNotify?.('graceful-drain', { target: context.target, ...payload })
        );

        if (!drainResult.drained) {
          return {
            strategy: this.name,
            success: false,
            message: `Drain timed out after ${drainResult.waitedMs}ms — pod restart skipped`,
          };
        }
      }

      await k8s.client.rolloutRestart(k8s.deployment, namespace);
      context.onNotify?.('pod-restart', {
        target: context.target,
        deployment: k8s.deployment,
        namespace,
      });

      return {
        strategy: this.name,
        success: true,
        message: `Triggered rollout restart for deployment/${k8s.deployment} in ${namespace}`,
      };
    } catch (error) {
      return {
        strategy: this.name,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export class HpaBoostStrategy implements HealingStrategy {
  readonly name: HealingStrategyName = 'hpa-boost';

  async execute(context: HealingContext): Promise<HealingActionResult> {
    const hpa = context.kubernetes?.hpa;
    if (!hpa?.client || !hpa.name) {
      return {
        strategy: this.name,
        success: false,
        message: 'HPA scaling client or HPA name not configured',
      };
    }

    const namespace = hpa.namespace ?? context.kubernetes?.namespace ?? 'default';
    const boostMin = hpa.boostMinReplicas ?? 2;

    try {
      const currentMin = await hpa.client.getHpaMinReplicas(hpa.name, namespace);
      if (boostMin <= currentMin) {
        return {
          strategy: this.name,
          success: true,
          message: `HPA ${hpa.name} already at minReplicas=${currentMin}`,
        };
      }

      await hpa.client.setHpaMinReplicas(hpa.name, namespace, boostMin);

      const restoreAfterMs = hpa.restoreAfterMs ?? 5 * 60 * 1000;
      setTimeout(() => {
        void hpa.client?.setHpaMinReplicas(hpa.name, namespace, currentMin);
      }, restoreAfterMs);

      context.onNotify?.('hpa-boost', {
        target: context.target,
        hpa: hpa.name,
        namespace,
        from: currentMin,
        to: boostMin,
        restoreAfterMs,
      });

      return {
        strategy: this.name,
        success: true,
        message: `Boosted HPA ${hpa.name} minReplicas ${currentMin} → ${boostMin}`,
      };
    } catch (error) {
      return {
        strategy: this.name,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createStrategy(
  name: HealingStrategyName,
  fallbackMethod?: string
): HealingStrategy {
  switch (name) {
    case 'auto-restart':
      return new AutoRestartStrategy();
    case 'config-rollback':
      return new ConfigRollbackStrategy();
    case 'memory-cleanup':
      return new MemoryCleanupStrategy();
    case 'safe-mode':
      return new SafeModeStrategy(fallbackMethod);
    case 'pod-restart':
      return new PodRestartStrategy();
    case 'hpa-boost':
      return new HpaBoostStrategy();
    default:
      throw new Error(`Unknown healing strategy: ${name}`);
  }
}
