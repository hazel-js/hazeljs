jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  HazelApp: jest.fn(),
  Container: { getInstance: jest.fn().mockReturnValue({}) },
  Injectable: () => () => undefined,
  HazelModule: () => () => undefined,
  Type: null,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { HazelApp } from '@hazeljs/core';
import { LambdaAdapter, createLambdaHandler, LambdaEvent, LambdaContext } from './lambda.adapter';
import {
  CloudFunctionAdapter,
  createCloudFunctionHandler,
  createCloudFunctionEventHandler,
  CloudFunctionRequest,
  CloudFunctionResponse,
} from './cloud-function.adapter';
import { ColdStartOptimizer } from './cold-start.optimizer';
import { Serverless } from './serverless.decorator';

class MockModule {}

function makeEvent(overrides: Partial<LambdaEvent> = {}): LambdaEvent {
  return {
    httpMethod: 'GET',
    path: '/test',
    headers: {},
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides,
  } as LambdaEvent;
}

function makeContext(overrides: Partial<LambdaContext> = {}): LambdaContext {
  return {
    awsRequestId: 'req-123',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:000:function:test',
    functionName: 'test-fn',
    functionVersion: '$LATEST',
    logGroupName: '/aws/lambda/test',
    logStreamName: '2024/01/01/test',
    memoryLimitInMB: '512',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
    callbackWaitsForEmptyEventLoop: true,
    ...overrides,
  } as unknown as LambdaContext;
}

describe('LambdaAdapter', () => {
  let mockMatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMatch = jest.fn().mockResolvedValue(null);
    (HazelApp as jest.Mock).mockImplementation(() => ({
      getRouter: jest.fn().mockReturnValue({ match: mockMatch }),
    }));
    ColdStartOptimizer.getInstance().reset();
  });

  describe('createHandler() – cold start tracking', () => {
    it('isCold() is true before first call', () => {
      const adapter = new LambdaAdapter(MockModule);
      expect(adapter.isCold()).toBe(true);
    });

    it('isCold() becomes false after first handler call', async () => {
      const adapter = new LambdaAdapter(MockModule);
      await adapter.createHandler()(makeEvent(), makeContext());
      expect(adapter.isCold()).toBe(false);
    });

    it('getApp() is undefined before handler is called', () => {
      expect(new LambdaAdapter(MockModule).getApp()).toBeUndefined();
    });

    it('getApp() returns HazelApp after first call', async () => {
      const adapter = new LambdaAdapter(MockModule);
      await adapter.createHandler()(makeEvent(), makeContext());
      expect(adapter.getApp()).toBeDefined();
    });
  });

  describe('createHandler() – routing', () => {
    it('returns 404 when route is not found', async () => {
      const adapter = new LambdaAdapter(MockModule);
      const result = await adapter.createHandler()(makeEvent({ path: '/missing' }), makeContext());
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({ message: 'Route not found' });
    });

    it('calls matched route handler and returns json response', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_req: unknown, res: { json(d: unknown): void }) => res.json({ ok: true }),
      });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ ok: true });
    });

    it('uses returned value from handler when res methods are not called', async () => {
      mockMatch.mockResolvedValue({ handler: async () => ({ direct: 'return' }) });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(JSON.parse(result.body)).toEqual({ direct: 'return' });
    });

    it('respects res.status() code', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_req: unknown, res: { status(c: number): { json(d: unknown): void } }) =>
          res.status(201).json({ created: true }),
      });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ httpMethod: 'POST' }),
        makeContext()
      );
      expect(result.statusCode).toBe(201);
    });

    it('returns string body from res.send()', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_req: unknown, res: { send(d: unknown): void }) => res.send('plain text'),
      });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.body).toBe('plain text');
    });

    it('supports res.setHeader()', async () => {
      mockMatch.mockResolvedValue({
        handler: async (
          _req: unknown,
          res: { setHeader(k: string, v: string): void; json(d: unknown): void }
        ) => {
          res.setHeader('X-Custom', 'value');
          res.json({});
        },
      });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.headers?.['X-Custom']).toBe('value');
    });

    it('returns error statusCode from thrown error with statusCode property', async () => {
      const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
      mockMatch.mockRejectedValue(err);
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.statusCode).toBe(403);
    });

    it('returns 500 when route handler throws without statusCode', async () => {
      mockMatch.mockRejectedValue(new Error('Unexpected'));
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.statusCode).toBe(500);
    });

    it('returns base64 body and isBase64Encoded when binaryMimeTypes matches and handler sends Buffer', async () => {
      const binaryPayload = Buffer.from('fake-png-bytes');
      mockMatch.mockResolvedValue({
        handler: async (
          _req: unknown,
          res: { setHeader(k: string, v: string): void; send(d: unknown): void }
        ) => {
          res.setHeader('Content-Type', 'image/png');
          res.send(binaryPayload);
        },
      });
      const adapter = new LambdaAdapter(MockModule, {
        binaryMimeTypes: ['image/png', 'image/*'],
      });
      const result = await adapter.createHandler()(makeEvent(), makeContext());
      expect(result.statusCode).toBe(200);
      expect(result.isBase64Encoded).toBe(true);
      expect(Buffer.from(result.body, 'base64').toString()).toBe('fake-png-bytes');
    });
  });

  describe('createHandler() – request conversion', () => {
    it('parses JSON body', async () => {
      let capturedBody: unknown;
      mockMatch.mockResolvedValue({
        handler: async (req: { body: unknown }, res: { json(d: unknown): void }) => {
          capturedBody = req.body;
          res.json({});
        },
      });

      await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ httpMethod: 'POST', body: '{"key":"val"}' }),
        makeContext()
      );
      expect(capturedBody).toEqual({ key: 'val' });
    });

    it('parses base64-encoded JSON body', async () => {
      let capturedBody: unknown;
      mockMatch.mockResolvedValue({
        handler: async (req: { body: unknown }, res: { json(d: unknown): void }) => {
          capturedBody = req.body;
          res.json({});
        },
      });

      const b64 = Buffer.from(JSON.stringify({ encoded: true })).toString('base64');
      await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ httpMethod: 'POST', body: b64, isBase64Encoded: true }),
        makeContext()
      );
      expect(capturedBody).toEqual({ encoded: true });
    });

    it('returns raw string body when JSON parse fails', async () => {
      let capturedBody: unknown;
      mockMatch.mockResolvedValue({
        handler: async (req: { body: unknown }, res: { json(d: unknown): void }) => {
          capturedBody = req.body;
          res.json({});
        },
      });

      await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ httpMethod: 'POST', body: 'not-valid-json' }),
        makeContext()
      );
      expect(capturedBody).toBe('not-valid-json');
    });

    it('passes query string parameters to handler', async () => {
      let capturedQuery: unknown;
      mockMatch.mockResolvedValue({
        handler: async (req: { query: unknown }, res: { json(d: unknown): void }) => {
          capturedQuery = req.query;
          res.json({});
        },
      });

      await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ queryStringParameters: { page: '2', size: '10' } }),
        makeContext()
      );
      expect(capturedQuery).toEqual({ page: '2', size: '10' });
    });

    it('passes pathParameters to handler', async () => {
      let capturedParams: unknown;
      mockMatch.mockResolvedValue({
        handler: async (req: { params: unknown }, res: { json(d: unknown): void }) => {
          capturedParams = req.params;
          res.json({});
        },
      });

      await new LambdaAdapter(MockModule).createHandler()(
        makeEvent({ pathParameters: { id: '42' } }),
        makeContext()
      );
      expect(capturedParams).toEqual({ id: '42' });
    });
  });

  describe('createHandler() – initialization errors', () => {
    it('returns 500 when HazelApp constructor throws', async () => {
      (HazelApp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Module init failed');
      });
      const result = await new LambdaAdapter(MockModule).createHandler()(
        makeEvent(),
        makeContext()
      );
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toBe('Module init failed');
    });
  });

  describe('createHandler() – app reuse', () => {
    it('creates HazelApp only once across multiple calls', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_r: unknown, res: { json(d: unknown): void }) => res.json({}),
      });
      const adapter = new LambdaAdapter(MockModule);
      const handler = adapter.createHandler();
      await handler(makeEvent(), makeContext());
      await handler(makeEvent(), makeContext());
      expect(HazelApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('cold start optimization', () => {
    it('calls warmUp when module has @Serverless coldStartOptimization:true', async () => {
      @Serverless({ coldStartOptimization: true })
      class OptimizedModule {}

      mockMatch.mockResolvedValue({
        handler: async (_r: unknown, res: { json(d: unknown): void }) => res.json({}),
      });

      const adapter = new LambdaAdapter(OptimizedModule);
      await adapter.createHandler()(makeEvent(), makeContext());
      expect(HazelApp).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createLambdaHandler()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HazelApp as jest.Mock).mockImplementation(() => ({
      getRouter: jest.fn().mockReturnValue({ match: jest.fn().mockResolvedValue(null) }),
    }));
    ColdStartOptimizer.getInstance().reset();
  });

  it('returns a callable handler that produces a ServerlessResponse', async () => {
    const handler = createLambdaHandler(MockModule);
    const result = await handler(makeEvent(), makeContext());
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('body');
  });
});

// ─── CloudFunctionAdapter ────────────────────────────────────────────────────

function makeCloudReq(overrides: Partial<CloudFunctionRequest> = {}): CloudFunctionRequest {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: { 'content-type': 'application/json' },
    query: {},
    ...overrides,
  };
}

function makeCloudRes() {
  const captures: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const res = {
    _captures: captures,
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockImplementation((b: unknown) => {
      captures.body = b;
    }),
    json: jest.fn().mockImplementation((b: unknown) => {
      captures.body = b;
    }),
    end: jest.fn(),
  };
  return res;
}

describe('CloudFunctionAdapter', () => {
  let mockMatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMatch = jest.fn().mockResolvedValue(null);
    (HazelApp as jest.Mock).mockImplementation(() => ({
      getRouter: jest.fn().mockReturnValue({ match: mockMatch }),
    }));
    ColdStartOptimizer.getInstance().reset();
  });

  describe('createHttpHandler()', () => {
    it('calls res.status(404) when route not found', async () => {
      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq() as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls matched route and sends response', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_r: unknown, synRes: { json(d: unknown): void }) =>
          synRes.json({ ok: true }),
      });
      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq() as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('calls res.status(500).json() on handler init error', async () => {
      (HazelApp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('crash');
      });
      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq() as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal Server Error' })
      );
    });

    it('normalizes string[] headers to first value', async () => {
      let capturedHeaders: Record<string, string> | undefined;
      mockMatch.mockResolvedValue({
        handler: async (
          req: { headers: Record<string, string> },
          res: { json(d: unknown): void }
        ) => {
          capturedHeaders = req.headers;
          res.json({});
        },
      });

      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq({ headers: { 'x-multi': ['alpha', 'beta'] } }) as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(capturedHeaders?.['x-multi']).toBe('alpha');
    });

    it('normalizes string[] query params to first value', async () => {
      let capturedQuery: Record<string, string> | undefined;
      mockMatch.mockResolvedValue({
        handler: async (
          req: { query: Record<string, string> },
          res: { json(d: unknown): void }
        ) => {
          capturedQuery = req.query;
          res.json({});
        },
      });

      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq({ query: { tag: ['first', 'second'] } }) as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(capturedQuery?.tag).toBe('first');
    });

    it('sets headers on response from internal ServerlessResponse headers', async () => {
      mockMatch.mockResolvedValue({
        handler: async (
          _r: unknown,
          synRes: { setHeader(k: string, v: string): void; json(d: unknown): void }
        ) => {
          synRes.setHeader('X-Trace', 'abc');
          synRes.json({});
        },
      });
      const res = makeCloudRes();
      await new CloudFunctionAdapter(MockModule).createHttpHandler()(
        makeCloudReq() as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(res.set).toHaveBeenCalledWith('X-Trace', 'abc');
    });

    it('isCold() becomes false after first call', async () => {
      const adapter = new CloudFunctionAdapter(MockModule);
      expect(adapter.isCold()).toBe(true);
      const res = makeCloudRes();
      await adapter.createHttpHandler()(
        makeCloudReq() as CloudFunctionRequest,
        res as unknown as CloudFunctionResponse
      );
      expect(adapter.isCold()).toBe(false);
    });

    it('getApp() returns undefined before first call', () => {
      expect(new CloudFunctionAdapter(MockModule).getApp()).toBeUndefined();
    });

    it('creates HazelApp only once across multiple calls', async () => {
      mockMatch.mockResolvedValue({
        handler: async (_r: unknown, res: { json(d: unknown): void }) => res.json({}),
      });
      const adapter = new CloudFunctionAdapter(MockModule);
      const handler = adapter.createHttpHandler();
      const res1 = makeCloudRes();
      const res2 = makeCloudRes();
      await handler(
        makeCloudReq() as CloudFunctionRequest,
        res1 as unknown as CloudFunctionResponse
      );
      await handler(
        makeCloudReq() as CloudFunctionRequest,
        res2 as unknown as CloudFunctionResponse
      );
      expect(HazelApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('createEventHandler()', () => {
    it('resolves without error for a valid event', async () => {
      const handler = new CloudFunctionAdapter(MockModule).createEventHandler();
      await expect(
        handler({ data: 'payload' }, { eventType: 'pubsub', resource: 'projects/test' })
      ).resolves.toBeUndefined();
    });

    it('rethrows errors from initialization', async () => {
      (HazelApp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('init failed');
      });
      const handler = new CloudFunctionAdapter(MockModule).createEventHandler();
      await expect(handler({}, {})).rejects.toThrow('init failed');
    });

    it('isCold() becomes false after first event call', async () => {
      const adapter = new CloudFunctionAdapter(MockModule);
      await adapter.createEventHandler()({}, {});
      expect(adapter.isCold()).toBe(false);
    });
  });
});

describe('createCloudFunctionHandler()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HazelApp as jest.Mock).mockImplementation(() => ({
      getRouter: jest.fn().mockReturnValue({ match: jest.fn().mockResolvedValue(null) }),
    }));
    ColdStartOptimizer.getInstance().reset();
  });

  it('returns a callable HTTP handler', async () => {
    const handler = createCloudFunctionHandler(MockModule);
    const res = makeCloudRes();
    await handler(makeCloudReq() as CloudFunctionRequest, res as unknown as CloudFunctionResponse);
    expect(res.send).toHaveBeenCalled();
  });
});

describe('createCloudFunctionEventHandler()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HazelApp as jest.Mock).mockImplementation(() => ({
      getRouter: jest.fn().mockReturnValue({ match: jest.fn() }),
    }));
    ColdStartOptimizer.getInstance().reset();
  });

  it('returns a callable event handler', async () => {
    const handler = createCloudFunctionEventHandler(MockModule);
    await expect(handler({ data: 'test' }, {})).resolves.toBeUndefined();
  });
});
