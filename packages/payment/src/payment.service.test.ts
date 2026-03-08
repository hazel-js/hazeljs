import { PaymentService } from './payment.service';
import type { PaymentProvider } from './providers/provider.interface';
import type { CreateCheckoutSessionOptions, CreateCustomerOptions } from './types/payment.types';

function createMockProvider(name: string): PaymentProvider {
  return {
    name,
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({ sessionId: `sess_${name}`, url: `https://pay.${name}.com/checkout` }),
    createCustomer: jest.fn().mockResolvedValue({
      id: `cus_${name}`,
      email: 'test@example.com',
      name: null,
      metadata: {},
    }),
    getCustomer: jest.fn().mockResolvedValue({
      id: `cus_${name}`,
      email: 'test@example.com',
      name: null,
      metadata: {},
    }),
    listSubscriptions: jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'sub_1', status: 'active', customerId: `cus_${name}` }] }),
    getCheckoutSession: jest.fn().mockResolvedValue({
      id: `sess_${name}`,
      url: null,
      customerId: `cus_${name}`,
      status: 'complete',
    }),
    isWebhookConfigured: jest.fn().mockReturnValue(true),
    parseWebhookEvent: jest.fn().mockReturnValue({ type: 'checkout.session.completed' }),
  };
}

describe('PaymentService', () => {
  const mockStripe = createMockProvider('stripe');
  const mockPaypal = createMockProvider('paypal');

  beforeEach(() => {
    jest.clearAllMocks();
    PaymentService.configure({
      providers: { stripe: mockStripe, paypal: mockPaypal },
    });
  });

  afterEach(() => {
    PaymentService.configure({ providers: {} } as never);
  });

  describe('constructor', () => {
    it('uses first provider as default when no defaultProvider set', async () => {
      const service = new PaymentService();
      const result = await service.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
      });
      expect(result.sessionId).toBe('sess_stripe');
      expect(mockStripe.createCheckoutSession).toHaveBeenCalled();
      expect(mockPaypal.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('throws when no providers registered', () => {
      PaymentService.configure({ providers: {} });
      expect(() => new PaymentService()).toThrow('No payment providers registered');
    });

    it('throws when module not configured', () => {
      PaymentService.configure({ providers: {} } as never);
      (PaymentService as unknown as { config: unknown }).config = null;
      expect(() => new PaymentService()).toThrow('PaymentModule not configured');
      PaymentService.configure({ providers: { stripe: mockStripe } });
    });
  });

  describe('defaultProvider', () => {
    it('uses defaultProvider when set', async () => {
      PaymentService.configure({
        defaultProvider: 'paypal',
        providers: { stripe: mockStripe, paypal: mockPaypal },
      });
      const service = new PaymentService();
      const result = await service.createCheckoutSession({
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
      });
      expect(result.sessionId).toBe('sess_paypal');
      expect(mockPaypal.createCheckoutSession).toHaveBeenCalled();
    });

    it('throws when defaultProvider is not in providers', async () => {
      PaymentService.configure({
        defaultProvider: 'nonexistent',
        providers: { stripe: mockStripe },
      });
      const service = new PaymentService();
      await expect(
        service.createCheckoutSession({
          successUrl: 'https://a.com/s',
          cancelUrl: 'https://a.com/c',
        })
      ).rejects.toThrow('Payment provider "nonexistent" not found');
    });
  });

  describe('getProviderNames', () => {
    it('returns registered provider names', () => {
      const service = new PaymentService();
      expect(service.getProviderNames()).toEqual(['stripe', 'paypal']);
    });
  });

  describe('getProvider', () => {
    it('returns provider by name', () => {
      const service = new PaymentService();
      const p = service.getProvider('paypal');
      expect(p.name).toBe('paypal');
    });

    it('throws when provider not found', () => {
      const service = new PaymentService();
      expect(() => service.getProvider('unknown')).toThrow('Payment provider "unknown" not found');
    });
  });

  describe('createCheckoutSession', () => {
    it('delegates to default provider without providerName', async () => {
      const service = new PaymentService();
      const options: CreateCheckoutSessionOptions = {
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
        customerEmail: 'u@example.com',
      };
      await service.createCheckoutSession(options);
      expect(mockStripe.createCheckoutSession).toHaveBeenCalledWith(options);
    });

    it('delegates to named provider when providerName given', async () => {
      const service = new PaymentService();
      const options: CreateCheckoutSessionOptions = {
        successUrl: 'https://a.com/s',
        cancelUrl: 'https://a.com/c',
      };
      await service.createCheckoutSession(options, 'paypal');
      expect(mockPaypal.createCheckoutSession).toHaveBeenCalledWith(options);
    });

    it('throws when named provider does not exist', async () => {
      const service = new PaymentService();
      await expect(
        service.createCheckoutSession(
          { successUrl: 'https://a.com/s', cancelUrl: 'https://a.com/c' },
          'nonexistent'
        )
      ).rejects.toThrow('Payment provider "nonexistent" not found');
    });
  });

  describe('createCustomer', () => {
    it('delegates to default provider', async () => {
      const service = new PaymentService();
      const options: CreateCustomerOptions = { email: 'new@example.com', name: 'Alice' };
      const customer = await service.createCustomer(options);
      expect(customer.id).toBe('cus_stripe');
      expect(mockStripe.createCustomer).toHaveBeenCalledWith(options);
    });

    it('delegates to named provider', async () => {
      const service = new PaymentService();
      await service.createCustomer({ email: 'b@example.com' }, 'paypal');
      expect(mockPaypal.createCustomer).toHaveBeenCalledWith({ email: 'b@example.com' });
    });
  });

  describe('getCustomer', () => {
    it('delegates to default provider', async () => {
      const service = new PaymentService();
      const customer = await service.getCustomer('cus_123');
      expect(customer).not.toBeNull();
      expect(mockStripe.getCustomer).toHaveBeenCalledWith('cus_123');
    });

    it('delegates to named provider', async () => {
      const service = new PaymentService();
      await service.getCustomer('cus_456', 'paypal');
      expect(mockPaypal.getCustomer).toHaveBeenCalledWith('cus_456');
    });
  });

  describe('listSubscriptions', () => {
    it('delegates to default provider', async () => {
      const service = new PaymentService();
      const result = await service.listSubscriptions('cus_1');
      expect(result.data).toHaveLength(1);
      expect(mockStripe.listSubscriptions).toHaveBeenCalledWith('cus_1', undefined);
    });

    it('passes status when provided', async () => {
      const service = new PaymentService();
      await service.listSubscriptions('cus_1', 'active', 'stripe');
      expect(mockStripe.listSubscriptions).toHaveBeenCalledWith('cus_1', 'active');
    });
  });

  describe('getCheckoutSession', () => {
    it('delegates to default provider', async () => {
      const service = new PaymentService();
      const session = await service.getCheckoutSession('sess_abc');
      expect(session.id).toBe('sess_stripe');
      expect(mockStripe.getCheckoutSession).toHaveBeenCalledWith('sess_abc');
    });

    it('delegates to named provider', async () => {
      const service = new PaymentService();
      await service.getCheckoutSession('sess_xyz', 'paypal');
      expect(mockPaypal.getCheckoutSession).toHaveBeenCalledWith('sess_xyz');
    });
  });

  describe('parseWebhookEvent', () => {
    it('delegates to named provider', () => {
      const service = new PaymentService();
      const event = service.parseWebhookEvent('stripe', 'payload', 'sig');
      expect(event).toEqual({ type: 'checkout.session.completed' });
      expect(mockStripe.parseWebhookEvent).toHaveBeenCalledWith('payload', 'sig');
    });

    it('throws when provider not found', () => {
      const service = new PaymentService();
      expect(() => service.parseWebhookEvent('unknown', 'p', 's')).toThrow(
        'Payment provider "unknown" not found'
      );
    });
  });

  describe('isWebhookConfigured', () => {
    it('returns true for named provider when configured', () => {
      const service = new PaymentService();
      expect(service.isWebhookConfigured('stripe')).toBe(true);
      expect(mockStripe.isWebhookConfigured).toHaveBeenCalled();
    });

    it('returns true when any provider has webhook configured', () => {
      const service = new PaymentService();
      expect(service.isWebhookConfigured()).toBe(true);
    });

    it('returns false when no provider has webhook configured', () => {
      (mockStripe.isWebhookConfigured as jest.Mock).mockReturnValue(false);
      (mockPaypal.isWebhookConfigured as jest.Mock).mockReturnValue(false);
      const service = new PaymentService();
      expect(service.isWebhookConfigured()).toBe(false);
    });
  });
});
