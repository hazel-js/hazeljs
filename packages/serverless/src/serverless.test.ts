import { Serverless, getServerlessMetadata, isServerless } from './serverless.decorator';
import { ColdStartOptimizer, OptimizeColdStart, KeepAliveHelper } from './cold-start.optimizer';
import { LambdaAdapter, createLambdaHandler } from './lambda.adapter';
import { CloudFunctionAdapter, createCloudFunctionHandler } from './cloud-function.adapter';
import { HazelModule } from '@hazeljs/core';

describe('Serverless Decorator', () => {
  it('should mark class as serverless', () => {
    @Serverless()
    class TestController {}

    expect(isServerless(TestController)).toBe(true);
  });

  it('should store serverless metadata', () => {
    const options = {
      memory: 1024,
      timeout: 60,
      coldStartOptimization: true,
    };

    @Serverless(options)
    class TestController {}

    const metadata = getServerlessMetadata(TestController);
    expect(metadata).toBeDefined();
    expect(metadata?.memory).toBe(1024);
    expect(metadata?.timeout).toBe(60);
    expect(metadata?.coldStartOptimization).toBe(true);
  });

  it('should use default options', () => {
    @Serverless()
    class TestController {}

    const metadata = getServerlessMetadata(TestController);
    expect(metadata?.memory).toBe(512);
    expect(metadata?.timeout).toBe(30);
    expect(metadata?.coldStartOptimization).toBe(true);
    expect(metadata?.autoSplit).toBe(false);
  });

  it('should return undefined for non-serverless class', () => {
    class TestController {}

    expect(isServerless(TestController)).toBe(false);
    expect(getServerlessMetadata(TestController)).toBeUndefined();
  });
});

describe('ColdStartOptimizer', () => {
  let optimizer: ColdStartOptimizer;

  beforeEach(() => {
    optimizer = ColdStartOptimizer.getInstance();
    optimizer.reset();
  });

  describe('warmUp', () => {
    it('should warm up the application', async () => {
      expect(optimizer.isWarm()).toBe(false);

      await optimizer.warmUp();

      expect(optimizer.isWarm()).toBe(true);
      expect(optimizer.getWarmupTimestamp()).toBeDefined();
    });

    it('should not warm up twice', async () => {
      await optimizer.warmUp();
      const firstTimestamp = optimizer.getWarmupTimestamp();

      await optimizer.warmUp();
      const secondTimestamp = optimizer.getWarmupTimestamp();

      expect(firstTimestamp).toBe(secondTimestamp);
    });

    it('should preload critical modules', async () => {
      await optimizer.warmUp();

      const preloaded = optimizer.getPreloadedModules();
      expect(preloaded.length).toBeGreaterThan(0);
      expect(preloaded).toContain('http');
      expect(preloaded).toContain('crypto');
    });
  });

  describe('isWarm', () => {
    it('should return false initially', () => {
      expect(optimizer.isWarm()).toBe(false);
    });

    it('should return true after warmup', async () => {
      await optimizer.warmUp();
      expect(optimizer.isWarm()).toBe(true);
    });
  });

  describe('getWarmupDuration', () => {
    it('should return undefined before warmup', () => {
      expect(optimizer.getWarmupDuration()).toBeUndefined();
    });

    it('should return duration after warmup', async () => {
      await optimizer.warmUp();
      const duration = optimizer.getWarmupDuration();

      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset warmup state', async () => {
      await optimizer.warmUp();
      expect(optimizer.isWarm()).toBe(true);

      optimizer.reset();

      expect(optimizer.isWarm()).toBe(false);
      expect(optimizer.getWarmupTimestamp()).toBeUndefined();
      expect(optimizer.getPreloadedModules()).toHaveLength(0);
    });
  });
});

describe('OptimizeColdStart Decorator', () => {
  let optimizer: ColdStartOptimizer;

  beforeEach(() => {
    optimizer = ColdStartOptimizer.getInstance();
    optimizer.reset();
  });

  it('should warm up before method execution', async () => {
    class TestClass {
      @OptimizeColdStart()
      async testMethod() {
        return 'result';
      }
    }

    const instance = new TestClass();
    expect(optimizer.isWarm()).toBe(false);

    const result = await instance.testMethod();

    expect(result).toBe('result');
    expect(optimizer.isWarm()).toBe(true);
  });
});

describe('KeepAliveHelper', () => {
  let helper: KeepAliveHelper;

  beforeEach(() => {
    helper = new KeepAliveHelper();
  });

  afterEach(() => {
    helper.stop();
  });

  it('should start keep-alive', () => {
    expect(() => {
      helper.start('http://example.com', 1000);
    }).not.toThrow();
  });

  it('should stop keep-alive', () => {
    helper.start('http://example.com', 1000);

    expect(() => {
      helper.stop();
    }).not.toThrow();
  });
});

describe('LambdaAdapter', () => {
  @HazelModule({
    controllers: [],
  })
  class TestModule {}

  let adapter: LambdaAdapter;

  beforeEach(() => {
    adapter = new LambdaAdapter(TestModule);
  });

  it('should create Lambda adapter', () => {
    expect(adapter).toBeDefined();
  });

  it('should create handler function', () => {
    const handler = adapter.createHandler();
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should be cold on first check', () => {
    expect(adapter.isCold()).toBe(true);
  });
});

describe('createLambdaHandler', () => {
  @HazelModule({
    controllers: [],
  })
  class TestModule {}

  it('should create Lambda handler', () => {
    const handler = createLambdaHandler(TestModule);
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });
});

describe('CloudFunctionAdapter', () => {
  @HazelModule({
    controllers: [],
  })
  class TestModule {}

  let adapter: CloudFunctionAdapter;

  beforeEach(() => {
    adapter = new CloudFunctionAdapter(TestModule);
  });

  it('should create Cloud Function adapter', () => {
    expect(adapter).toBeDefined();
  });

  it('should create HTTP handler', () => {
    const handler = adapter.createHttpHandler();
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should create event handler', () => {
    const handler = adapter.createEventHandler();
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should be cold on first check', () => {
    expect(adapter.isCold()).toBe(true);
  });
});

describe('createCloudFunctionHandler', () => {
  @HazelModule({
    controllers: [],
  })
  class TestModule {}

  it('should create Cloud Function HTTP handler', () => {
    const handler = createCloudFunctionHandler(TestModule);
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });
});
