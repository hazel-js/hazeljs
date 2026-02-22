import { EventEmitterService } from './event-emitter.service';

describe('EventEmitterService', () => {
  describe('constructor', () => {
    it('should create instance with default options when no options provided', () => {
      const service = new EventEmitterService();
      expect(service).toBeInstanceOf(EventEmitterService);
    });

    it('should create instance with custom options', () => {
      const service = new EventEmitterService({
        wildcard: true,
        delimiter: ':',
        maxListeners: 20,
      });
      expect(service).toBeInstanceOf(EventEmitterService);
    });
  });

  describe('emit', () => {
    it('should emit event and invoke listeners', () => {
      const service = new EventEmitterService();
      const listener = jest.fn();
      service.on('test.event', listener);

      const result = service.emit('test.event', { data: 'payload' });

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ data: 'payload' });
    });

    it('should emit event with multiple arguments', () => {
      const service = new EventEmitterService();
      const listener = jest.fn();
      service.on('multi', listener);

      service.emit('multi', 'arg1', 'arg2', 123);

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should return false when no listeners', () => {
      const service = new EventEmitterService();
      const result = service.emit('nonexistent.event');
      expect(result).toBe(false);
    });
  });

  describe('emitAsync', () => {
    it('should emit event asynchronously and return promise', async () => {
      const service = new EventEmitterService();
      const listener = jest.fn().mockResolvedValue(undefined);
      service.on('async.event', listener);

      const promise = service.emitAsync('async.event', { id: 1 });
      expect(promise).toBeInstanceOf(Promise);

      const results = await promise;
      expect(listener).toHaveBeenCalledWith({ id: 1 });
      expect(results).toEqual([undefined]);
    });

    it('should handle async listeners that return values', async () => {
      const service = new EventEmitterService();
      const listener = jest.fn().mockResolvedValue('result');
      service.on('async.event', listener);

      const results = await service.emitAsync('async.event');
      expect(results).toEqual(['result']);
    });
  });
});
