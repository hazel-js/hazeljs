import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const mockCreateCheckoutSession = jest.fn();
const mockParseWebhookEvent = jest.fn();

describe('PaymentController', () => {
  let controller: PaymentController;
  let res: { status: jest.Mock; json: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const paymentService = {
      createCheckoutSession: mockCreateCheckoutSession,
      parseWebhookEvent: mockParseWebhookEvent,
    } as unknown as PaymentService;
    controller = new PaymentController(paymentService);
  });

  describe('createCheckoutSession', () => {
    it('returns 200 and session result on success', async () => {
      mockCreateCheckoutSession.mockResolvedValue({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com',
      });
      await controller.createCheckoutSession(
        {
          successUrl: 'https://a.com/s',
          cancelUrl: 'https://a.com/c',
        },
        res as never
      );
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        { successUrl: 'https://a.com/s', cancelUrl: 'https://a.com/c' },
        undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com',
      });
    });

    it('passes provider from body when present', async () => {
      mockCreateCheckoutSession.mockResolvedValue({ sessionId: 'cs_456', url: null });
      await controller.createCheckoutSession(
        {
          successUrl: 'https://a.com/s',
          cancelUrl: 'https://a.com/c',
          provider: 'stripe',
        },
        res as never
      );
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        { successUrl: 'https://a.com/s', cancelUrl: 'https://a.com/c' },
        'stripe'
      );
    });

    it('returns 400 and error message on failure', async () => {
      mockCreateCheckoutSession.mockRejectedValue(new Error('Invalid price ID'));
      await controller.createCheckoutSession(
        { successUrl: 'https://a.com/s', cancelUrl: 'https://a.com/c' },
        res as never
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid price ID' });
    });

    it('returns 400 with generic message when error is not Error instance', async () => {
      mockCreateCheckoutSession.mockRejectedValue('string error');
      await controller.createCheckoutSession(
        { successUrl: 'https://a.com/s', cancelUrl: 'https://a.com/c' },
        res as never
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
    });
  });

  describe('webhook', () => {
    it('returns 400 when raw body is missing', async () => {
      const req = { headers: { 'stripe-signature': 'sig' } };
      await controller.webhook('stripe', req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Webhook requires raw body');
      expect(mockParseWebhookEvent).not.toHaveBeenCalled();
    });

    it('uses rawBody when present', async () => {
      mockParseWebhookEvent.mockReturnValue({ type: 'checkout.session.completed' });
      const req = {
        headers: { 'stripe-signature': 'v1,sig' },
        rawBody: Buffer.from('{"id":"evt_1"}'),
      };
      await controller.webhook('stripe', req as never, res as never);
      expect(mockParseWebhookEvent).toHaveBeenCalledWith('stripe', req.rawBody, 'v1,sig');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        provider: 'stripe',
        type: 'checkout.session.completed',
      });
    });

    it('uses body as string when rawBody absent and body is string', async () => {
      mockParseWebhookEvent.mockReturnValue({ type: 'invoice.paid' });
      const req = {
        headers: { 'stripe-signature': 'sig' },
        body: '{"id":"evt_2"}',
      };
      await controller.webhook('stripe', req as never, res as never);
      expect(mockParseWebhookEvent).toHaveBeenCalledWith('stripe', '{"id":"evt_2"}', 'sig');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        provider: 'stripe',
        type: 'invoice.paid',
      });
    });

    it('uses body as Buffer when rawBody absent and body is Buffer', async () => {
      const buf = Buffer.from('{}');
      mockParseWebhookEvent.mockReturnValue({});
      const req = { headers: {}, body: buf };
      await controller.webhook('paypal', req as never, res as never);
      expect(mockParseWebhookEvent).toHaveBeenCalledWith('paypal', buf, '');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        received: true,
        provider: 'paypal',
        type: undefined,
      });
    });

    it('returns 400 when parseWebhookEvent throws', async () => {
      mockParseWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      const req = { headers: { 'stripe-signature': 'bad' }, rawBody: 'payload' };
      await controller.webhook('stripe', req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid signature');
    });

    it('uses paypal-transmission-sig header when stripe-signature absent', async () => {
      mockParseWebhookEvent.mockReturnValue({ type: 'payment.capture.completed' });
      const req = {
        headers: { 'paypal-transmission-sig': 'paypal_sig' },
        rawBody: 'payload',
      };
      await controller.webhook('paypal', req as never, res as never);
      expect(mockParseWebhookEvent).toHaveBeenCalledWith('paypal', 'payload', 'paypal_sig');
    });
  });
});
