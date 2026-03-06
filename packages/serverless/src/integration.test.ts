/**
 * Integration tests: real HazelJS app through Lambda and Cloud Function adapters.
 * No mocks of @hazeljs/core — uses real HazelApp, router, and controllers.
 */
import 'reflect-metadata';
import { Controller, Get, Post, Body, Param, HazelModule } from '@hazeljs/core';
import { createLambdaHandler, LambdaEvent, LambdaContext } from './lambda.adapter';
import {
  createCloudFunctionHandler,
  CloudFunctionRequest,
  CloudFunctionResponse,
} from './cloud-function.adapter';
import { ColdStartOptimizer } from './cold-start.optimizer';

// ─── Minimal app for integration ───────────────────────────────────────────

@Controller('/api')
class IntegrationController {
  @Get('/ping')
  ping() {
    return { ok: true, message: 'pong' };
  }

  @Get('/params/:id')
  getById(@Param('id') id: string) {
    return { id };
  }

  @Post('/echo')
  echo(@Body() body: { x?: number; text?: string }) {
    return { echoed: body };
  }
}

@HazelModule({
  controllers: [IntegrationController],
})
class IntegrationTestModule {}

// ─── Lambda helpers ──────────────────────────────────────────────────────────

function makeLambdaEvent(overrides: Partial<LambdaEvent> = {}): LambdaEvent {
  return {
    httpMethod: 'GET',
    path: '/api/ping',
    headers: { 'content-type': 'application/json' },
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides,
  } as LambdaEvent;
}

function makeLambdaContext(overrides: Partial<LambdaContext> = {}): LambdaContext {
  return {
    awsRequestId: 'int-test-req-1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:000:function:integration-test',
    functionName: 'integration-test',
    functionVersion: '$LATEST',
    getRemainingTimeInMillis: () => 30000,
    callbackWaitsForEmptyEventLoop: true,
    ...overrides,
  } as unknown as LambdaContext;
}

// ─── Cloud Function helpers ──────────────────────────────────────────────────

function makeCloudReq(overrides: Partial<CloudFunctionRequest> = {}): CloudFunctionRequest {
  return {
    method: 'GET',
    url: '/api/ping',
    path: '/api/ping',
    headers: { 'content-type': 'application/json' },
    query: {},
    ...overrides,
  };
}

function makeCloudRes(): CloudFunctionResponse & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
} {
  const state = {
    _status: 200,
    _body: undefined as unknown,
    _headers: {} as Record<string, string>,
  };
  return Object.assign(state, {
    status(code: number) {
      state._status = code;
      return this;
    },
    set(field: string, value: string) {
      state._headers[field] = value;
      return this;
    },
    send(body: unknown) {
      state._body = body;
    },
    json(body: unknown) {
      state._body = body;
    },
    end() {},
  });
}

// ─── Integration tests ───────────────────────────────────────────────────────

describe('integration (real HazelApp)', () => {
  beforeEach(() => {
    ColdStartOptimizer.getInstance().reset();
  });

  describe('createLambdaHandler', () => {
    const handler = createLambdaHandler(IntegrationTestModule);

    it('GET /api/ping returns 200 and pong', async () => {
      const result = await handler(
        makeLambdaEvent({ httpMethod: 'GET', path: '/api/ping' }),
        makeLambdaContext()
      );
      expect(result.statusCode).toBe(200);
      const data = JSON.parse(result.body);
      expect(data).toEqual({ ok: true, message: 'pong' });
    });

    it('GET /api/params/123 returns 200 and id', async () => {
      const result = await handler(
        makeLambdaEvent({
          httpMethod: 'GET',
          path: '/api/params/123',
          pathParameters: { id: '123' },
        }),
        makeLambdaContext()
      );
      expect(result.statusCode).toBe(200);
      const data = JSON.parse(result.body);
      expect(data).toEqual({ id: '123' });
    });

    it('POST /api/echo returns 200 and echoed body', async () => {
      const result = await handler(
        makeLambdaEvent({
          httpMethod: 'POST',
          path: '/api/echo',
          body: JSON.stringify({ x: 1, text: 'hello' }),
        }),
        makeLambdaContext()
      );
      expect(result.statusCode).toBe(200);
      const data = JSON.parse(result.body);
      expect(data).toEqual({ echoed: { x: 1, text: 'hello' } });
    });

    it('GET /api/missing returns 404', async () => {
      const result = await handler(
        makeLambdaEvent({ httpMethod: 'GET', path: '/api/missing' }),
        makeLambdaContext()
      );
      expect(result.statusCode).toBe(404);
      const data = JSON.parse(result.body);
      expect(data.message).toBe('Route not found');
    });
  });

  describe('createCloudFunctionHandler', () => {
    const handler = createCloudFunctionHandler(IntegrationTestModule);

    it('GET /api/ping returns 200 and pong', async () => {
      const res = makeCloudRes();
      await handler(makeCloudReq({ method: 'GET', url: '/api/ping', path: '/api/ping' }), res);
      expect(res._status).toBe(200);
      const body = typeof res._body === 'string' ? JSON.parse(res._body) : res._body;
      expect(body).toEqual({ ok: true, message: 'pong' });
    });

    it('POST /api/echo returns 200 and echoed body', async () => {
      const res = makeCloudRes();
      await handler(
        makeCloudReq({
          method: 'POST',
          url: '/api/echo',
          path: '/api/echo',
          body: { x: 2, text: 'world' },
        }),
        res
      );
      expect(res._status).toBe(200);
      const body = typeof res._body === 'string' ? JSON.parse(res._body) : res._body;
      expect(body).toEqual({ echoed: { x: 2, text: 'world' } });
    });

    it('GET /api/missing returns 404', async () => {
      const res = makeCloudRes();
      await handler(
        makeCloudReq({ method: 'GET', url: '/api/missing', path: '/api/missing' }),
        res
      );
      expect(res._status).toBe(404);
    });
  });
});
