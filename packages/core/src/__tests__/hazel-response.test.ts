import { HazelExpressResponse } from '../hazel-response';
import { Response } from '../types';

describe('HazelExpressResponse', () => {
  let mockRes: Partial<Response>;
  let hazelResponse: HazelExpressResponse;

  beforeEach(() => {
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
    };
    hazelResponse = new HazelExpressResponse(mockRes as Response);
  });

  describe('setHeader', () => {
    it('should set header when headers not sent', () => {
      hazelResponse.setHeader('Content-Type', 'application/json');

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should not set header after headers are sent', () => {
      // Trigger header sending by writing
      hazelResponse.write('test');
      jest.clearAllMocks();

      hazelResponse.setHeader('X-Custom', 'value');

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should set status code', () => {
      const result = hazelResponse.status(404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(result).toBe(hazelResponse);
    });

    it('should return this for chaining', () => {
      const result = hazelResponse.status(200);

      expect(result).toBeInstanceOf(HazelExpressResponse);
    });

    it('should not set status after headers are sent', () => {
      hazelResponse.write('test');
      jest.clearAllMocks();

      hazelResponse.status(500);

      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('write', () => {
    it('should set streaming headers on first write', () => {
      hazelResponse.write('chunk1');

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
      expect(mockRes.send).toHaveBeenCalledWith('chunk1');
    });

    it('should send subsequent chunks without setting headers', () => {
      hazelResponse.write('chunk1');
      jest.clearAllMocks();

      hazelResponse.write('chunk2');

      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith('chunk2');
    });
  });

  describe('end', () => {
    it('should end response when streaming', () => {
      hazelResponse.write('test');
      hazelResponse.end();

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should not end response when not streaming', () => {
      hazelResponse.end();

      expect(mockRes.end).not.toHaveBeenCalled();
    });
  });

  describe('json', () => {
    it('should send JSON data', () => {
      const data = { message: 'success' };
      hazelResponse.json(data);

      expect(mockRes.json).toHaveBeenCalledWith(data);
    });

    it('should handle error objects specially', () => {
      const data = { error: 'Something went wrong' };
      hazelResponse.json(data);

      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });

    it('should not send JSON if streaming', () => {
      hazelResponse.write('streaming');
      hazelResponse.json({ data: 'test' });

      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should not send JSON if headers already sent', () => {
      hazelResponse.write('test');
      hazelResponse.json({ data: 'test' });

      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle circular references safely', () => {
      const data: Record<string, unknown> = { name: 'test' };
      data.res = mockRes;

      hazelResponse.json(data);

      expect(mockRes.json).toHaveBeenCalledWith({
        name: 'test',
        res: '[Response Object]',
      });
    });

    it('should handle primitive values', () => {
      hazelResponse.json('string value');
      expect(mockRes.json).toHaveBeenCalledWith('string value');

      jest.clearAllMocks();
      hazelResponse = new HazelExpressResponse(mockRes as Response);
      hazelResponse.json(123);
      expect(mockRes.json).toHaveBeenCalledWith(123);

      jest.clearAllMocks();
      hazelResponse = new HazelExpressResponse(mockRes as Response);
      hazelResponse.json(true);
      expect(mockRes.json).toHaveBeenCalledWith(true);
    });

    it('should handle null and undefined', () => {
      hazelResponse.json(null);
      expect(mockRes.json).toHaveBeenCalledWith(null);

      jest.clearAllMocks();
      hazelResponse = new HazelExpressResponse(mockRes as Response);
      hazelResponse.json(undefined);
      expect(mockRes.json).toHaveBeenCalledWith(undefined);
    });

    it('should handle JSON stringify errors', () => {
      // Create an object that will fail JSON.stringify
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      // Mock JSON.stringify to throw
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockImplementation(() => {
        throw new Error('Stringify failed');
      });

      hazelResponse.json(circular);

      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to serialize response' });

      // Restore original
      JSON.stringify = originalStringify;
    });
  });
});
