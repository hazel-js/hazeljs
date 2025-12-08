import { Test } from '@hazeljs/core';
import { DemoController, DemoV1Controller, DemoV2Controller } from './demo.controller';
import { DemoService } from './demo.service';

describe('DemoController', () => {
  let controller: DemoController;
  let mockDemoService: any;

  beforeEach(async () => {
    mockDemoService = {
      getRequestId: jest.fn().mockReturnValue('req-test-123'),
      getConfig: jest.fn().mockReturnValue({
        nodeEnv: 'test',
        port: 3000,
        hasDbUrl: true,
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [],
    })
      .overrideProvider(DemoService)
      .useValue(mockDemoService)
      .compile();

    controller = module.get(DemoController);
  });

  describe('optionalParam', () => {
    it('should handle request without ID', async () => {
      const result = await controller.optionalParam();

      expect(result).toBeDefined();
      expect(result.feature).toBe('Optional Parameters');
      expect(result.id).toBe('not provided');
      expect(result.message).toBe('No ID provided');
    });

    it('should handle request with ID', async () => {
      const result = await controller.optionalParam('123');

      expect(result).toBeDefined();
      expect(result.feature).toBe('Optional Parameters');
      expect(result.id).toBe('123');
      expect(result.message).toBe('Received ID: 123');
    });
  });

  describe('wildcardRoute', () => {
    it('should match wildcard path', async () => {
      const result = await controller.wildcardRoute('some/nested/path');

      expect(result).toBeDefined();
      expect(result.feature).toBe('Wildcard Routes');
      expect(result.path).toBe('some/nested/path');
      expect(result.message).toBe('Matched wildcard path: some/nested/path');
    });

    it('should handle empty wildcard path', async () => {
      const result = await controller.wildcardRoute('');

      expect(result).toBeDefined();
      expect(result.feature).toBe('Wildcard Routes');
      expect(result.path).toBe('');
    });
  });

  describe('scopedProvider', () => {
    it('should return request ID from scoped service', async () => {
      const result = await controller.scopedProvider();

      expect(result).toBeDefined();
      expect(result.feature).toBe('Scoped Providers');
      expect(result.requestId).toBe('req-test-123');
      expect(result.message).toBe('Each request gets a unique ID from request-scoped service');
      expect(mockDemoService.getRequestId).toHaveBeenCalled();
    });
  });

  describe('configExample', () => {
    it('should return configuration from service', async () => {
      const result = await controller.configExample();

      expect(result).toBeDefined();
      expect(result.feature).toBe('Configuration Module');
      expect(result.config).toEqual({
        nodeEnv: 'test',
        port: 3000,
        hasDbUrl: true,
      });
      expect(result.message).toBe('Configuration loaded from .env files');
      expect(mockDemoService.getConfig).toHaveBeenCalled();
    });
  });
});

describe('DemoV1Controller', () => {
  let controller: DemoV1Controller;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DemoV1Controller],
      providers: [],
    }).compile();

    controller = module.get(DemoV1Controller);
  });

  describe('getData', () => {
    it('should return version 1 data', async () => {
      const result = await controller.getData();

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.data).toEqual({ message: 'This is version 1' });
    });

    it('should have correct structure', async () => {
      const result = await controller.getData();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('message');
    });
  });
});

describe('DemoV2Controller', () => {
  let controller: DemoV2Controller;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DemoV2Controller],
      providers: [],
    }).compile();

    controller = module.get(DemoV2Controller);
  });

  describe('getData', () => {
    it('should return version 2 data with metadata', async () => {
      const result = await controller.getData();

      expect(result).toBeDefined();
      expect(result.version).toBe(2);
      expect(result.data).toEqual({ message: 'This is version 2' });
      expect(result.metadata).toBeDefined();
    });

    it('should include timestamp in metadata', async () => {
      const result = await controller.getData();

      expect(result.metadata.timestamp).toBeDefined();
      expect(new Date(result.metadata.timestamp)).toBeInstanceOf(Date);
    });

    it('should include features in metadata', async () => {
      const result = await controller.getData();

      expect(result.metadata.features).toBeDefined();
      expect(Array.isArray(result.metadata.features)).toBe(true);
      expect(result.metadata.features).toContain('enhanced');
      expect(result.metadata.features).toContain('improved');
    });

    it('should have more fields than v1', async () => {
      const result = await controller.getData();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(Object.keys(result).length).toBeGreaterThan(2);
    });
  });
});

describe('DemoService', () => {
  it('should be defined', () => {
    expect(DemoService).toBeDefined();
  });
});
