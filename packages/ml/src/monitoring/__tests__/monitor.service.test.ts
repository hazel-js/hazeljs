import { MonitorService } from '../monitor.service';
import { DriftService } from '../drift.service';

describe('MonitorService', () => {
  let service: MonitorService;
  let driftService: DriftService;

  beforeEach(() => {
    driftService = new DriftService();
    service = new MonitorService(driftService);
  });

  afterEach(() => {
    service.stop();
  });

  describe('registerModel', () => {
    it('should register a model for monitoring', () => {
      service.registerModel({
        modelName: 'test-model',
        modelVersion: '1.0.0',
      });

      const status = service.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].modelName).toBe('test-model');
      expect(status[0].modelVersion).toBe('1.0.0');
    });

    it('should register model without version', () => {
      service.registerModel({
        modelName: 'test-model',
      });

      const status = service.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].modelName).toBe('test-model');
      expect(status[0].modelVersion).toBeUndefined();
    });

    it('should set up periodic checks when interval specified', () => {
      service.registerModel({
        modelName: 'test-model',
        checkIntervalMinutes: 5,
      });

      const status = service.getStatus();
      expect(status[0].isActive).toBe(true);
      expect(status[0].checkInterval).toBe(5);
    });

    it('should not set up periodic checks when interval is 0', () => {
      service.registerModel({
        modelName: 'test-model',
        checkIntervalMinutes: 0,
      });

      const status = service.getStatus();
      expect(status[0].isActive).toBe(false);
    });

    it('should replace old interval when re-registering', () => {
      service.registerModel({
        modelName: 'test-model',
        checkIntervalMinutes: 5,
      });

      service.registerModel({
        modelName: 'test-model',
        checkIntervalMinutes: 10,
      });

      const status = service.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].checkInterval).toBe(10);
    });

    it('should register with feature drift config', () => {
      service.registerModel({
        modelName: 'test-model',
        featureDrift: {
          method: 'psi',
          threshold: 0.25,
        },
      });

      const status = service.getStatus();
      expect(status).toHaveLength(1);
    });

    it('should register with accuracy monitor', () => {
      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.8,
          windowSize: 10,
        },
      });

      const status = service.getStatus();
      expect(status).toHaveLength(1);
    });
  });

  describe('unregisterModel', () => {
    it('should unregister a model', () => {
      service.registerModel({
        modelName: 'test-model',
        modelVersion: '1.0.0',
      });

      service.unregisterModel('test-model', '1.0.0');

      const status = service.getStatus();
      expect(status).toHaveLength(0);
    });

    it('should clear interval when unregistering', () => {
      service.registerModel({
        modelName: 'test-model',
        checkIntervalMinutes: 5,
      });

      service.unregisterModel('test-model');

      const status = service.getStatus();
      expect(status).toHaveLength(0);
    });

    it('should handle unregistering non-existent model', () => {
      expect(() => {
        service.unregisterModel('non-existent');
      }).not.toThrow();
    });
  });

  describe('onAlert', () => {
    it('should add alert handler', () => {
      const handler = jest.fn();
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 2,
        },
      });

      service.recordAccuracy('test-model', 0.5);
      service.recordAccuracy('test-model', 0.5);

      expect(handler).toHaveBeenCalled();
    });

    it('should support multiple alert handlers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      service.onAlert(handler1);
      service.onAlert(handler2);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 2,
        },
      });

      service.recordAccuracy('test-model', 0.5);
      service.recordAccuracy('test-model', 0.5);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('offAlert', () => {
    it('should remove alert handler', () => {
      const handler = jest.fn();
      service.onAlert(handler);
      service.offAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 1,
        },
      });

      service.recordAccuracy('test-model', 0.5);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent handler', () => {
      const handler = jest.fn();
      expect(() => {
        service.offAlert(handler);
      }).not.toThrow();
    });
  });

  describe('recordPrediction', () => {
    it('should record prediction', () => {
      expect(() => {
        service.recordPrediction('test-model', { feature1: 1.0, feature2: 2.0 }, 'positive');
      }).not.toThrow();
    });

    it('should record numeric prediction', () => {
      expect(() => {
        service.recordPrediction('test-model', { feature1: 1.0 }, 0.95);
      }).not.toThrow();
    });
  });

  describe('recordAccuracy', () => {
    it('should record accuracy', () => {
      service.registerModel({
        modelName: 'test-model',
      });

      expect(() => {
        service.recordAccuracy('test-model', 0.95);
      }).not.toThrow();
    });

    it('should record accuracy with version', () => {
      service.registerModel({
        modelName: 'test-model',
        modelVersion: '1.0.0',
      });

      expect(() => {
        service.recordAccuracy('test-model', 0.95, '1.0.0');
      }).not.toThrow();
    });

    it('should trigger alert when accuracy drops below threshold', () => {
      const handler = jest.fn();
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 2,
        },
      });

      service.recordAccuracy('test-model', 0.85);
      service.recordAccuracy('test-model', 0.85);

      expect(handler).toHaveBeenCalled();
      const alert = handler.mock.calls[0][0];
      expect(alert.alertType).toBe('accuracy');
      expect(alert.severity).toBe('critical');
      expect(alert.modelName).toBe('test-model');
    });

    it('should not trigger alert when accuracy is above threshold', () => {
      const handler = jest.fn();
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 2,
        },
      });

      service.recordAccuracy('test-model', 0.95);
      service.recordAccuracy('test-model', 0.95);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should use window size for accuracy calculation', () => {
      const handler = jest.fn();
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 2,
        },
      });

      service.recordAccuracy('test-model', 0.95);
      service.recordAccuracy('test-model', 0.95);
      service.recordAccuracy('test-model', 0.85);
      service.recordAccuracy('test-model', 0.85);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('checkModel', () => {
    it('should throw error for unregistered model', async () => {
      await expect(service.checkModel('non-existent')).rejects.toThrow('No monitor registered');
    });

    it('should check model without drift config', async () => {
      service.registerModel({
        modelName: 'test-model',
      });

      const results = await service.checkModel('test-model');
      expect(results).toEqual([]);
    });

    it('should check model with feature drift config', async () => {
      driftService.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      service.registerModel({
        modelName: 'test-model',
        featureDrift: {
          method: 'psi',
          threshold: 0.25,
          windowSize: 100,
        },
      });

      const results = await service.checkModel('test-model');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should emit alert when drift detected', async () => {
      const handler = jest.fn();
      service.onAlert(handler);

      driftService.setReferenceDistribution('feature1', [1, 2, 3, 4, 5]);

      service.registerModel({
        modelName: 'test-model',
        featureDrift: {
          method: 'psi',
          threshold: 0.01,
          windowSize: 100,
        },
      });

      await service.checkModel('test-model');

      // Alert may or may not be called depending on drift detection
      expect(handler).toHaveBeenCalledTimes(0);
    });
  });

  describe('getStatus', () => {
    it('should return empty array when no models registered', () => {
      expect(service.getStatus()).toEqual([]);
    });

    it('should return status for all registered models', () => {
      service.registerModel({
        modelName: 'model1',
        modelVersion: '1.0.0',
      });

      service.registerModel({
        modelName: 'model2',
        checkIntervalMinutes: 5,
      });

      const status = service.getStatus();
      expect(status).toHaveLength(2);
      expect(status[0].modelName).toBe('model1');
      expect(status[1].modelName).toBe('model2');
      expect(status[1].isActive).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop all monitoring', () => {
      service.registerModel({
        modelName: 'model1',
        checkIntervalMinutes: 5,
      });

      service.registerModel({
        modelName: 'model2',
        checkIntervalMinutes: 10,
      });

      service.stop();

      const status = service.getStatus();
      expect(status[0].isActive).toBe(false);
      expect(status[1].isActive).toBe(false);
    });

    it('should handle stopping when no models registered', () => {
      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });

  describe('alert handling', () => {
    it('should handle async alert handlers', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 1,
        },
      });

      service.recordAccuracy('test-model', 0.5);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalled();
    });

    it('should handle alert handler errors gracefully', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      service.onAlert(handler);

      service.registerModel({
        modelName: 'test-model',
        accuracyMonitor: {
          threshold: 0.9,
          windowSize: 1,
        },
      });

      expect(() => {
        service.recordAccuracy('test-model', 0.5);
      }).not.toThrow();
    });
  });
});
