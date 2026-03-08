/**
 * Payment service that delegates to registered providers (Stripe, PayPal, etc.).
 */

import { Service } from '@hazeljs/core';
import type { PaymentProvider } from './providers/provider.interface';
import type { ListSubscriptionsResult } from './providers/provider.interface';
import type {
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreateCustomerOptions,
  Customer,
  CheckoutSessionInfo,
  SubscriptionStatusFilter,
} from './types/payment.types';

export interface PaymentServiceConfig {
  defaultProvider?: string;
  providers: Record<string, PaymentProvider>;
}

@Service()
export class PaymentService {
  private config: PaymentServiceConfig;

  constructor() {
    this.config = PaymentService.getConfig();
    const names = Object.keys(this.config.providers);
    if (names.length === 0) {
      throw new Error(
        'No payment providers registered. Call PaymentModule.forRoot({ providers: { stripe: new StripePaymentProvider(...) } }).'
      );
    }
  }

  private static config: PaymentServiceConfig | null = null;

  static configure(config: PaymentServiceConfig): void {
    PaymentService.config = config;
  }

  private static getConfig(): PaymentServiceConfig {
    if (!PaymentService.config) {
      throw new Error(
        'PaymentModule not configured. Call PaymentModule.forRoot({ providers: { ... } }) in your app module.'
      );
    }
    return PaymentService.config;
  }

  private resolveProvider(providerName?: string): PaymentProvider {
    const name =
      providerName ?? this.config.defaultProvider ?? Object.keys(this.config.providers)[0];
    const provider = this.config.providers[name];
    if (!provider) {
      throw new Error(
        `Payment provider "${name}" not found. Registered: ${Object.keys(this.config.providers).join(', ')}.`
      );
    }
    return provider;
  }

  /** Get a provider by name for provider-specific APIs (e.g. Stripe client). */
  getProvider<T extends PaymentProvider = PaymentProvider>(name: string): T {
    const provider = this.config.providers[name];
    if (!provider) {
      throw new Error(
        `Payment provider "${name}" not found. Registered: ${Object.keys(this.config.providers).join(', ')}.`
      );
    }
    return provider as T;
  }

  /** List registered provider names. */
  getProviderNames(): string[] {
    return Object.keys(this.config.providers);
  }

  async createCheckoutSession(
    options: CreateCheckoutSessionOptions,
    providerName?: string
  ): Promise<CreateCheckoutSessionResult> {
    return this.resolveProvider(providerName).createCheckoutSession(options);
  }

  async createCustomer(options: CreateCustomerOptions, providerName?: string): Promise<Customer> {
    return this.resolveProvider(providerName).createCustomer(options);
  }

  async getCustomer(customerId: string, providerName?: string): Promise<Customer | null> {
    return this.resolveProvider(providerName).getCustomer(customerId);
  }

  async listSubscriptions(
    customerId: string,
    status?: SubscriptionStatusFilter,
    providerName?: string
  ): Promise<ListSubscriptionsResult> {
    return this.resolveProvider(providerName).listSubscriptions(customerId, status);
  }

  async getCheckoutSession(sessionId: string, providerName?: string): Promise<CheckoutSessionInfo> {
    return this.resolveProvider(providerName).getCheckoutSession(sessionId);
  }

  /**
   * Verify and parse a webhook event. Use the provider name that received the webhook (e.g. 'stripe').
   */
  parseWebhookEvent(providerName: string, payload: string | Buffer, signature: string): unknown {
    return this.getProvider(providerName).parseWebhookEvent(payload, signature);
  }

  isWebhookConfigured(providerName?: string): boolean {
    if (providerName) {
      return this.getProvider(providerName).isWebhookConfigured();
    }
    return Object.values(this.config.providers).some((p) => p.isWebhookConfigured());
  }
}
