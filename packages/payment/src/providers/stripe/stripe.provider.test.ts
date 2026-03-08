import { StripePaymentProvider, STRIPE_PROVIDER_NAME } from './stripe.provider';

const mockCheckoutSessionsCreate = jest.fn();
const mockCustomersCreate = jest.fn();
const mockCustomersRetrieve = jest.fn();
const mockSubscriptionsList = jest.fn();
const mockCheckoutSessionsRetrieve = jest.fn();
const mockWebhooksConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
        retrieve: mockCheckoutSessionsRetrieve,
      },
    },
    customers: {
      create: mockCustomersCreate,
      retrieve: mockCustomersRetrieve,
    },
    subscriptions: {
      list: mockSubscriptionsList,
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  }));
});

describe('StripePaymentProvider', () => {
  const baseOptions = { secretKey: 'sk_test_xxx' };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/pay',
    });
    mockCustomersCreate.mockResolvedValue({
      id: 'cus_123',
      email: 'u@example.com',
      name: 'User',
      metadata: {},
      deleted: false,
    });
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_123',
      email: 'u@example.com',
      name: 'User',
      metadata: {},
      deleted: false,
    });
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_1', status: 'active', customer: 'cus_123' }],
    });
    mockCheckoutSessionsRetrieve.mockResolvedValue({
      id: 'cs_123',
      url: null,
      customer: 'cus_123',
      subscription: 'sub_1',
      status: 'complete',
    });
    mockWebhooksConstructEvent.mockReturnValue({ type: 'checkout.session.completed' });
  });

  describe('constructor', () => {
    it('throws when no secret key', () => {
      expect(() => new StripePaymentProvider({})).toThrow('Stripe secret key is required');
    });

    it('uses options.secretKey', () => {
      const provider = new StripePaymentProvider(baseOptions);
      expect(provider).toBeDefined();
      expect(provider.getClient()).toBeDefined();
    });

    it('uses STRIPE_SECRET_KEY env when secretKey not in options', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_env_xxx';
      const provider = new StripePaymentProvider({});
      expect(provider).toBeDefined();
      delete process.env.STRIPE_SECRET_KEY;
    });

    it('sets webhookSecret from options', () => {
      const provider = new StripePaymentProvider({ ...baseOptions, webhookSecret: 'whsec_xxx' });
      expect(provider.isWebhookConfigured()).toBe(true);
    });

    it('sets webhookSecret from env', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_xxx';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_env';
      const provider = new StripePaymentProvider({});
      expect(provider.isWebhookConfigured()).toBe(true);
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });
  });

  describe('name', () => {
    it('has correct provider name', () => {
      const provider = new StripePaymentProvider(baseOptions);
      expect(provider.name).toBe(STRIPE_PROVIDER_NAME);
      expect(STRIPE_PROVIDER_NAME).toBe('stripe');
    });
  });

  describe('createCheckoutSession', () => {
    it('creates one-time payment session with lineItems', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      const result = await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        lineItems: [
          {
            priceData: {
              currency: 'usd',
              unitAmount: 1999,
              productData: { name: 'Pro Plan' },
            },
            quantity: 1,
          },
        ],
      });
      expect(result).toEqual({ sessionId: 'cs_123', url: 'https://checkout.stripe.com/pay' });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://a.com/s',
          cancel_url: 'https://a.com/c',
          mode: 'payment',
          line_items: expect.any(Array),
        })
      );
    });

    it('creates session with priceId line items', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        lineItems: [{ priceId: 'price_xxx', quantity: 2 }],
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_xxx', quantity: 2 }],
        })
      );
    });

    it('creates subscription session with trial', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        subscription: { priceId: 'price_sub', quantity: 1, trialPeriodDays: 14 },
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_sub', quantity: 1 }],
          subscription_data: { trial_period_days: 14 },
        })
      );
    });

    it('passes customerId and clientReferenceId', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        customerId: 'cus_existing',
        clientReferenceId: 'order_123',
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
          client_reference_id: 'order_123',
        })
      );
    });

    it('passes customerEmail when no customerId', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        customerEmail: 'new@example.com',
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'new@example.com',
        })
      );
    });

    it('does not pass customer_email when customerId is set', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        customerId: 'cus_exist',
        customerEmail: 'ignore@example.com',
      });
      const call = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(call.customer).toBe('cus_exist');
      expect(call.customer_email).toBeUndefined();
    });

    it('passes allowPromotionCodes when true', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        allowPromotionCodes: true,
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_promotion_codes: true,
        })
      );
    });

    it('creates subscription session without trial', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        subscription: { priceId: 'price_sub', quantity: 2 },
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_sub', quantity: 2 }],
        })
      );
      const call = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(call.subscription_data).toBeUndefined();
    });

    it('passes description and images in priceData productData', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        lineItems: [
          {
            priceData: {
              currency: 'eur',
              unitAmount: 999,
              productData: {
                name: 'Pro',
                description: 'Pro plan',
                images: ['https://example.com/img.png'],
              },
            },
            quantity: 1,
          },
        ],
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: expect.objectContaining({
                  name: 'Pro',
                  description: 'Pro plan',
                  images: ['https://example.com/img.png'],
                }),
              }),
            }),
          ],
        })
      );
    });

    it('merges providerOptions.stripe', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        providerOptions: {
          stripe: { payment_intent_data: { setup_future_usage: 'off_session' } },
        },
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent_data: { setup_future_usage: 'off_session' },
        })
      );
    });

    it('throws when line item has neither priceId nor priceData', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await expect(
        provider.createCheckoutSession({
          successUrl: 'https://a.com/s',
          cancelUrl: 'https://a.com/c',
          lineItems: [{} as never],
        })
      ).rejects.toThrow('Each line item must have priceId or priceData');
    });
  });

  describe('createCustomer', () => {
    it('creates customer and maps to Customer type', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      const customer = await provider.createCustomer({
        email: 'u@example.com',
        name: 'Alice',
        metadata: { userId: 'u1' },
      });
      expect(customer).toEqual({
        id: 'cus_123',
        email: 'u@example.com',
        name: 'User',
        metadata: {},
      });
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'u@example.com',
        name: 'Alice',
        metadata: { userId: 'u1' },
      });
    });

    it('maps customer with undefined metadata', async () => {
      mockCustomersCreate.mockResolvedValueOnce({
        id: 'cus_no_meta',
        email: 'n@example.com',
        name: null,
        metadata: undefined,
        deleted: false,
      });
      const provider = new StripePaymentProvider(baseOptions);
      const customer = await provider.createCustomer({ email: 'n@example.com' });
      expect(customer.metadata).toBeUndefined();
    });
  });

  describe('getCustomer', () => {
    it('returns null for deleted customer', async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({ id: 'cus_del', deleted: true });
      const provider = new StripePaymentProvider(baseOptions);
      const customer = await provider.getCustomer('cus_del');
      expect(customer).toBeNull();
    });

    it('returns mapped customer for existing', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      const customer = await provider.getCustomer('cus_123');
      expect(customer).not.toBeNull();
      expect(customer?.id).toBe('cus_123');
    });
  });

  describe('listSubscriptions', () => {
    it('returns list with data array', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      const result = await provider.listSubscriptions('cus_123');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('sub_1');
      expect(result.data[0].status).toBe('active');
      expect(result.data[0].customerId).toBe('cus_123');
    });

    it('passes status filter', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      await provider.listSubscriptions('cus_123', 'active');
      expect(mockSubscriptionsList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });
  });

  describe('getCheckoutSession', () => {
    it('returns CheckoutSessionInfo with id, url, customerId, subscriptionId, status', async () => {
      const provider = new StripePaymentProvider(baseOptions);
      const session = await provider.getCheckoutSession('cs_123');
      expect(session.id).toBe('cs_123');
      expect(session.url).toBeNull();
      expect(session.customerId).toBe('cus_123');
      expect(session.subscriptionId).toBe('sub_1');
      expect(session.status).toBe('complete');
    });

    it('handles expanded customer and subscription objects', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValueOnce({
        id: 'cs_expand',
        url: 'https://checkout.stripe.com',
        customer: { id: 'cus_expanded', object: 'customer' },
        subscription: { id: 'sub_expanded', object: 'subscription' },
        status: 'complete',
      });
      const provider = new StripePaymentProvider(baseOptions);
      const session = await provider.getCheckoutSession('cs_expand');
      expect(session.customerId).toBe('cus_expanded');
      expect(session.subscriptionId).toBe('sub_expanded');
    });
  });

  describe('isWebhookConfigured', () => {
    it('returns false when no webhook secret', () => {
      const provider = new StripePaymentProvider(baseOptions);
      expect(provider.isWebhookConfigured()).toBe(false);
    });

    it('returns true when webhook secret set', () => {
      const provider = new StripePaymentProvider({ ...baseOptions, webhookSecret: 'whsec_xxx' });
      expect(provider.isWebhookConfigured()).toBe(true);
    });
  });

  describe('parseWebhookEvent', () => {
    it('throws when webhook secret not configured', () => {
      const provider = new StripePaymentProvider(baseOptions);
      expect(() => provider.parseWebhookEvent('payload', 'sig')).toThrow(
        'Stripe webhook secret is required'
      );
    });

    it('calls stripe.webhooks.constructEvent and returns event', () => {
      const provider = new StripePaymentProvider({ ...baseOptions, webhookSecret: 'whsec_xxx' });
      const event = provider.parseWebhookEvent('payload', 'sig');
      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith('payload', 'sig', 'whsec_xxx');
      expect(event).toEqual({ type: 'checkout.session.completed' });
    });
  });

  describe('getClient', () => {
    it('returns Stripe instance', () => {
      const provider = new StripePaymentProvider(baseOptions);
      const client = provider.getClient();
      expect(client).toBeDefined();
      expect(client.checkout.sessions.create).toBe(mockCheckoutSessionsCreate);
    });
  });
});
