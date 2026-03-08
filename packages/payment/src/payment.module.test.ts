jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));

import { PaymentModule } from './payment.module';
import { PaymentService } from './payment.service';
import type { PaymentProvider } from './providers/provider.interface';
import { STRIPE_PROVIDER_NAME } from './providers/stripe/stripe.provider';

const mockProvider: PaymentProvider = {
  name: 'mock',
  createCheckoutSession: jest
    .fn()
    .mockResolvedValue({ sessionId: 'sess_1', url: 'https://pay.com' }),
  createCustomer: jest
    .fn()
    .mockResolvedValue({ id: 'cus_1', email: 'a@b.com', name: null, metadata: {} }),
  getCustomer: jest
    .fn()
    .mockResolvedValue({ id: 'cus_1', email: 'a@b.com', name: null, metadata: {} }),
  listSubscriptions: jest.fn().mockResolvedValue({ data: [] }),
  getCheckoutSession: jest.fn().mockResolvedValue({ id: 'sess_1', url: null }),
  isWebhookConfigured: jest.fn().mockReturnValue(false),
  parseWebhookEvent: jest.fn().mockReturnValue({}),
};

describe('PaymentModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PaymentService as unknown as { config: unknown }).config = null;
  });

  it('forRoot with stripe option registers StripePaymentProvider', () => {
    const result = PaymentModule.forRoot({
      stripe: { secretKey: 'sk_test_xxx' },
    });
    expect(result).toBe(PaymentModule);

    const service = new PaymentService();
    expect(service.getProviderNames()).toContain(STRIPE_PROVIDER_NAME);
  });

  it('forRoot with providers option registers custom providers', () => {
    PaymentModule.forRoot({
      providers: { mock: mockProvider },
    });
    const service = new PaymentService();
    expect(service.getProviderNames()).toContain('mock');
    expect(service.getProvider('mock').name).toBe('mock');
  });

  it('forRoot merges stripe and providers', () => {
    PaymentModule.forRoot({
      stripe: { secretKey: 'sk_test_xxx' },
      providers: { custom: mockProvider },
    });
    const service = new PaymentService();
    expect(service.getProviderNames()).toContain(STRIPE_PROVIDER_NAME);
    expect(service.getProviderNames()).toContain('custom');
  });

  it('forRoot with defaultProvider sets it', async () => {
    PaymentModule.forRoot({
      defaultProvider: 'mock',
      providers: { stripe: mockProvider, mock: mockProvider },
    });
    const service = new PaymentService();
    const result = await service.createCheckoutSession({
      successUrl: 'https://a.com/s',
      cancelUrl: 'https://a.com/c',
    });
    expect(result.sessionId).toBe('sess_1');
    expect(mockProvider.createCheckoutSession).toHaveBeenCalled();
  });

  it('forRoot with only providers (no stripe) works', () => {
    PaymentModule.forRoot({ providers: { mock: mockProvider } });
    const service = new PaymentService();
    expect(service.getProviderNames()).toEqual(['mock']);
  });
});
