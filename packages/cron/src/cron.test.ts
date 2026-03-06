/// <reference types="jest" />

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  HazelModule: () => () => undefined,
  Container: { getInstance: jest.fn() },
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Container } from '@hazeljs/core';
import { CronService } from './cron.service';
import { CronModule } from './cron.module';
import { Cron, getCronMetadata, CRON_METADATA_KEY } from './cron.decorator';
import { CronExpression } from './cron.types';

// Use a minute-level cron expression that won't fire during tests
const EVERY_MINUTE = '* * * * *';

describe('CronService', () => {
  let service: CronService;

  beforeEach(() => {
    service = new CronService();
  });

  afterEach(() => {
    service.clearAll();
  });

  describe('registerJob()', () => {
    it('registers a job and increments count', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      expect(service.getJobCount()).toBe(1);
    });

    it('replaces an existing job with the same name', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      expect(service.getJobCount()).toBe(1);
    });

    it('does not auto-start when enabled is false', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn(), {
        cronTime: EVERY_MINUTE,
        enabled: false,
      });
      const status = service.getJobStatus('job1');
      expect(status).toBeDefined();
      expect(status?.enabled).toBe(false);
    });

    it('throws for invalid cron expression', () => {
      expect(() => service.registerJob('bad', 'not-a-cron', jest.fn())).toThrow(
        'Invalid cron expression'
      );
    });

    it('registers multiple independent jobs', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      service.registerJob('job2', EVERY_MINUTE, jest.fn());
      service.registerJob('job3', EVERY_MINUTE, jest.fn());
      expect(service.getJobCount()).toBe(3);
    });
  });

  describe('deleteJob()', () => {
    it('returns true and removes the job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      expect(service.deleteJob('job1')).toBe(true);
      expect(service.getJobCount()).toBe(0);
    });

    it('returns false for unknown job', () => {
      expect(service.deleteJob('unknown')).toBe(false);
    });
  });

  describe('startJob() / stopJob()', () => {
    it('startJob returns true for existing job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn(), {
        cronTime: EVERY_MINUTE,
        enabled: false,
      });
      expect(service.startJob('job1')).toBe(true);
    });

    it('startJob returns false for unknown job', () => {
      expect(service.startJob('unknown')).toBe(false);
    });

    it('stopJob returns true for existing job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      expect(service.stopJob('job1')).toBe(true);
    });

    it('stopJob returns false for unknown job', () => {
      expect(service.stopJob('unknown')).toBe(false);
    });
  });

  describe('enableJob() / disableJob()', () => {
    it('enableJob returns true for existing job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn(), {
        cronTime: EVERY_MINUTE,
        enabled: false,
      });
      expect(service.enableJob('job1')).toBe(true);
    });

    it('enableJob returns false for unknown job', () => {
      expect(service.enableJob('unknown')).toBe(false);
    });

    it('disableJob returns true for existing job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      expect(service.disableJob('job1')).toBe(true);
    });

    it('disableJob returns false for unknown job', () => {
      expect(service.disableJob('unknown')).toBe(false);
    });
  });

  describe('getJobStatus()', () => {
    it('returns status for registered job', () => {
      service.registerJob('job1', EVERY_MINUTE, jest.fn());
      const status = service.getJobStatus('job1');
      expect(status).toBeDefined();
      expect(status?.name).toBe('job1');
      expect(status?.runCount).toBe(0);
      expect(status?.enabled).toBe(true);
    });

    it('returns undefined for unknown job', () => {
      expect(service.getJobStatus('unknown')).toBeUndefined();
    });
  });

  describe('getAllJobStatuses()', () => {
    it('returns empty array when no jobs', () => {
      expect(service.getAllJobStatuses()).toEqual([]);
    });

    it('returns all job statuses', () => {
      service.registerJob('j1', EVERY_MINUTE, jest.fn());
      service.registerJob('j2', EVERY_MINUTE, jest.fn());
      const statuses = service.getAllJobStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.map((s) => s.name)).toContain('j1');
      expect(statuses.map((s) => s.name)).toContain('j2');
    });
  });

  describe('stopAll() / startAll() / clearAll()', () => {
    it('stopAll stops all registered jobs', () => {
      service.registerJob('j1', EVERY_MINUTE, jest.fn());
      service.registerJob('j2', EVERY_MINUTE, jest.fn());
      expect(() => service.stopAll()).not.toThrow();
    });

    it('startAll starts all registered jobs', () => {
      service.registerJob('j1', EVERY_MINUTE, jest.fn(), {
        cronTime: EVERY_MINUTE,
        enabled: false,
      });
      expect(() => service.startAll()).not.toThrow();
    });

    it('clearAll removes all jobs', () => {
      service.registerJob('j1', EVERY_MINUTE, jest.fn());
      service.registerJob('j2', EVERY_MINUTE, jest.fn());
      service.clearAll();
      expect(service.getJobCount()).toBe(0);
    });
  });

  describe('getJobCount()', () => {
    it('returns 0 when no jobs registered', () => {
      expect(service.getJobCount()).toBe(0);
    });

    it('returns correct count after adding/removing jobs', () => {
      service.registerJob('j1', EVERY_MINUTE, jest.fn());
      service.registerJob('j2', EVERY_MINUTE, jest.fn());
      expect(service.getJobCount()).toBe(2);
      service.deleteJob('j1');
      expect(service.getJobCount()).toBe(1);
    });
  });

  describe('job options: runOnInit', () => {
    it('executes callback immediately when runOnInit is true', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      service.registerJob('runNow', EVERY_MINUTE, callback, {
        cronTime: EVERY_MINUTE,
        runOnInit: true,
      });
      // Allow the async execute() to run
      await new Promise((r) => setTimeout(r, 20));
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('job options: onComplete / onError', () => {
    it('calls onComplete after successful execution (via runOnInit)', async () => {
      const onComplete = jest.fn();
      service.registerJob('complete-job', EVERY_MINUTE, jest.fn().mockResolvedValue(undefined), {
        cronTime: EVERY_MINUTE,
        runOnInit: true,
        onComplete,
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(onComplete).toHaveBeenCalled();
    });

    it('calls onError when callback throws (via runOnInit)', async () => {
      const onError = jest.fn();
      service.registerJob(
        'error-job',
        EVERY_MINUTE,
        jest.fn().mockRejectedValue(new Error('fail')),
        {
          cronTime: EVERY_MINUTE,
          runOnInit: true,
          onError,
        }
      );
      await new Promise((r) => setTimeout(r, 20));
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('startJob on disabled job', () => {
    it('warns but does not crash when starting a disabled job', () => {
      service.registerJob('disabled-job', EVERY_MINUTE, jest.fn(), {
        cronTime: EVERY_MINUTE,
        enabled: false,
      });
      // startJob calls job.start() which logs a warn since job is disabled
      expect(() => service.startJob('disabled-job')).not.toThrow();
    });
  });

  describe('starting an already-started job', () => {
    it('does not throw when starting a job that is already running', () => {
      service.registerJob('already-running', EVERY_MINUTE, jest.fn());
      // job is already started by registerJob
      expect(() => service.startJob('already-running')).not.toThrow();
    });
  });
});

describe('Cron decorator', () => {
  it('attaches metadata to the class', () => {
    class MyService {
      @Cron({ cronTime: EVERY_MINUTE, name: 'myJob' })
      doWork(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(CRON_METADATA_KEY, MyService);
    expect(metadata).toHaveLength(1);
    expect(metadata[0].methodName).toBe('doWork');
    expect(metadata[0].options.name).toBe('myJob');
    expect(metadata[0].options.cronTime).toBe(EVERY_MINUTE);
  });

  it('uses default name based on class and method when name is not provided', () => {
    class AnotherService {
      @Cron({ cronTime: EVERY_MINUTE })
      handleTask(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(CRON_METADATA_KEY, AnotherService);
    expect(metadata[0].options.name).toBe('AnotherService.handleTask');
  });

  it('accumulates metadata for multiple methods', () => {
    class MultiService {
      @Cron({ cronTime: EVERY_MINUTE, name: 'first' })
      firstJob(): void {
        // noop
      }

      @Cron({ cronTime: EVERY_MINUTE, name: 'second' })
      secondJob(): void {
        // noop
      }
    }

    const metadata = Reflect.getMetadata(CRON_METADATA_KEY, MultiService);
    expect(metadata).toHaveLength(2);
    const names = metadata.map((m: { options: { name: string } }) => m.options.name);
    expect(names).toContain('first');
    expect(names).toContain('second');
  });
});

describe('getCronMetadata()', () => {
  it('returns empty array for class with no @Cron decorators', () => {
    class Plain {
      doThing(): void {
        // noop
      }
    }
    const instance = new Plain();
    expect(getCronMetadata(instance)).toEqual([]);
  });

  it('returns metadata for class with @Cron decorators', () => {
    class Scheduled {
      @Cron({ cronTime: EVERY_MINUTE })
      job(): void {
        // noop
      }
    }
    const instance = new Scheduled();
    const meta = getCronMetadata(instance);
    expect(meta).toHaveLength(1);
    expect(meta[0].methodName).toBe('job');
  });
});

describe('CronModule', () => {
  const EVERY_MINUTE = '* * * * *';

  describe('forRoot()', () => {
    it('returns module configuration with defaults', () => {
      const result = CronModule.forRoot();
      expect(result.module).toBe(CronModule);
      expect(result.providers).toContain(CronService);
      expect(result.exports).toContain(CronService);
      expect(result.global).toBe(true);
    });

    it('respects isGlobal: false', () => {
      const result = CronModule.forRoot({ isGlobal: false });
      expect(result.global).toBe(false);
    });

    it('respects isGlobal: true explicitly', () => {
      const result = CronModule.forRoot({ isGlobal: true });
      expect(result.global).toBe(true);
    });
  });

  describe('registerJobsFromProvider()', () => {
    it('registers cron jobs from a provider with @Cron decorated methods', () => {
      const cronService = new CronService();
      (Container.getInstance as jest.Mock).mockReturnValue({
        resolve: jest.fn().mockReturnValue(cronService),
      });

      class TaskService {
        @Cron({ cronTime: EVERY_MINUTE, name: 'myTask' })
        doTask(): void {
          // noop
        }
      }

      const instance = new TaskService();
      CronModule.registerJobsFromProvider(instance);

      expect(cronService.getJobCount()).toBeGreaterThan(0);
      cronService.clearAll();
    });

    it('does nothing when CronService is not in container', () => {
      (Container.getInstance as jest.Mock).mockReturnValue({
        resolve: jest.fn().mockReturnValue(null),
      });

      class NoopService {}
      expect(() => CronModule.registerJobsFromProvider(new NoopService())).not.toThrow();
    });

    it('does nothing when provider has no @Cron metadata', () => {
      const cronService = new CronService();
      (Container.getInstance as jest.Mock).mockReturnValue({
        resolve: jest.fn().mockReturnValue(cronService),
      });

      class EmptyService {
        plainMethod(): void {
          // noop
        }
      }

      CronModule.registerJobsFromProvider(new EmptyService());
      expect(cronService.getJobCount()).toBe(0);
    });

    it('handles errors gracefully', () => {
      (Container.getInstance as jest.Mock).mockImplementation(() => {
        throw new Error('container not ready');
      });

      class TaskService {}
      expect(() => CronModule.registerJobsFromProvider(new TaskService())).not.toThrow();
    });
  });
});

describe('CronExpression constants', () => {
  it('EVERY_SECOND is a valid 6-field expression', () => {
    expect(CronExpression.EVERY_SECOND).toBe('* * * * * *');
  });

  it('EVERY_MINUTE is a valid expression', () => {
    expect(CronExpression.EVERY_MINUTE).toBe('0 * * * * *');
  });

  it('EVERY_HOUR is a valid expression', () => {
    expect(CronExpression.EVERY_HOUR).toBe('0 0 * * * *');
  });

  it('EVERY_DAY_AT_MIDNIGHT is a valid expression', () => {
    expect(CronExpression.EVERY_DAY_AT_MIDNIGHT).toBe('0 0 0 * * *');
  });

  it('EVERY_YEAR is a valid expression', () => {
    expect(CronExpression.EVERY_YEAR).toBe('0 0 0 1 1 *');
  });
});
