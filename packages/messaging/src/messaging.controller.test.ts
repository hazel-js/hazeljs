/**
 * MessagingController tests
 */
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import type { IChannelAdapter, IncomingMessage } from './types/message.types';
import { BadRequestException } from '@hazeljs/core';

const createMockMessage = (): IncomingMessage => ({
  id: '1',
  channel: 'telegram',
  conversationId: 'conv-1',
  userId: 'user-1',
  text: 'Hello',
  timestamp: new Date(),
});

const createMockAdapter = (channel: string): IChannelAdapter => ({
  channel: channel as 'telegram' | 'whatsapp' | 'viber',
  parseIncoming: jest.fn(),
  send: jest.fn().mockResolvedValue(undefined),
});

interface MockRes {
  statusCode: number;
  _headers: Record<string, string>;
  _body: string;
  status: (code: number) => MockRes;
  setHeader: (k: string, v: string) => MockRes;
  write: (chunk: string) => boolean;
  end: () => void;
  json: (obj: unknown) => MockRes;
}

const createMockRes = (): MockRes => {
  const endFn = jest.fn();
  const res: MockRes = {
    statusCode: 200,
    _headers: {},
    _body: '',
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }) as unknown as (code: number) => MockRes,
    setHeader: jest.fn((k: string, v: string) => {
      res._headers[k] = v;
      return res;
    }) as unknown as (k: string, v: string) => MockRes,
    write: jest.fn((chunk: string) => {
      res._body += chunk;
      return true;
    }) as unknown as (chunk: string) => boolean,
    end: endFn,
    json: jest.fn((obj: unknown) => {
      res._body = JSON.stringify(obj);
      endFn();
      return res;
    }) as unknown as (obj: unknown) => MockRes,
  };
  return res;
};

describe('MessagingController', () => {
  let messagingService: MessagingService;
  let telegramAdapter: IChannelAdapter;
  let whatsappAdapter: IChannelAdapter;

  beforeEach(() => {
    messagingService = new MessagingService({
      customHandler: jest.fn().mockResolvedValue('Reply'),
    });
    telegramAdapter = createMockAdapter('telegram');
    whatsappAdapter = createMockAdapter('whatsapp');
  });

  describe('webhookGet', () => {
    it('returns 404 for non-whatsapp channel', async () => {
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { query: {}, headers: {} };
      const res = createMockRes();

      await controller.webhookGet('telegram', req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.write).toHaveBeenCalledWith('Not found');
    });

    it('returns 404 when whatsapp adapter has no verifyWebhook', async () => {
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { query: {}, headers: {} };
      const res = createMockRes();

      await controller.webhookGet('whatsapp', req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns challenge when whatsapp verification succeeds', async () => {
      const originalEnv = process.env;
      process.env.WHATSAPP_VERIFY_TOKEN = 'secret';
      const waAdapter = {
        ...whatsappAdapter,
        verifyWebhook: jest.fn().mockReturnValue(true),
      };
      const controller = new MessagingController(messagingService, [waAdapter], false, undefined);
      const req = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'secret',
          'hub.challenge': 'challenge123',
        },
        headers: {},
      };
      const res = createMockRes();

      await controller.webhookGet('whatsapp', req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.write).toHaveBeenCalledWith('challenge123');
      process.env = originalEnv;
    });

    it('returns 403 when verification fails', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'secret';
      const waAdapter = {
        ...whatsappAdapter,
        verifyWebhook: jest.fn().mockReturnValue(false),
      };
      const controller = new MessagingController(messagingService, [waAdapter], false, undefined);
      const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong' }, headers: {} };
      const res = createMockRes();

      await controller.webhookGet('whatsapp', req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.write).toHaveBeenCalledWith('Verification failed');
    });
  });

  describe('webhookPost', () => {
    it('throws BadRequestException for unsupported channel', async () => {
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: {} };
      const res = createMockRes();

      await expect(controller.webhookPost('unknown', req as never, res as never)).rejects.toThrow(
        BadRequestException
      );
    });

    it('returns 200 with ok when parseIncoming returns null', async () => {
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(null);
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('processes message sync and sends reply', async () => {
      const msg = createMockMessage();
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(msg);
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: { update_id: 1, message: {} } };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(messagingService.handleMessage).toBeDefined();
      expect(telegramAdapter.send).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        text: 'Reply',
        replyToMessageId: '1',
      });
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('produces to Kafka when useKafka is true', async () => {
      const msg = createMockMessage();
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(msg);
      const producer = {
        send: jest.fn().mockResolvedValue(undefined),
      };
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        true,
        producer
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(producer.send).toHaveBeenCalledWith(
        'messaging.incoming',
        expect.objectContaining({
          key: 'conv-1', // sessionId ?? conversationId - mock has no sessionId
          value: expect.stringContaining('"channel":"telegram"'),
        })
      );
      expect(telegramAdapter.send).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('handles multiple messages from parseIncoming', async () => {
      const msg1 = createMockMessage();
      const msg2 = { ...createMockMessage(), id: '2', text: 'Second' };
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue([msg1, msg2]);
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(telegramAdapter.send).toHaveBeenCalledTimes(2);
    });

    it('handles body parse error', async () => {
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(null);
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = {};
      Object.defineProperty(req, 'body', {
        get: () => {
          throw new Error('parse error');
        },
      });
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(telegramAdapter.parseIncoming).toHaveBeenCalledWith({});
    });

    it('handles Kafka produce error and still returns 200', async () => {
      const msg = createMockMessage();
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(msg);
      const producer = {
        send: jest.fn().mockRejectedValue(new Error('Kafka unreachable')),
      };
      const controller = new MessagingController(
        messagingService,
        [telegramAdapter],
        true,
        producer
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('handles sync processing error and still returns 200', async () => {
      const msg = createMockMessage();
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(msg);
      const failingService = new MessagingService({
        customHandler: jest.fn().mockRejectedValue(new Error('AI service down')),
      });
      const controller = new MessagingController(
        failingService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('does not send when handleMessage returns null', async () => {
      const msg = createMockMessage();
      (telegramAdapter.parseIncoming as jest.Mock).mockReturnValue(msg);
      const noReplyService = new MessagingService({
        customHandler: jest.fn().mockResolvedValue(null),
      });
      const controller = new MessagingController(
        noReplyService,
        [telegramAdapter],
        false,
        undefined
      );
      const req = { body: {} };
      const res = createMockRes();

      await controller.webhookPost('telegram', req as never, res as never);

      expect(telegramAdapter.send).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
