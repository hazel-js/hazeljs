/**
 * Stripe implementation of PaymentProvider.
 */

import Stripe from 'stripe';
import type { PaymentProvider } from '../provider.interface';
import type { StripeProviderOptions } from './stripe.types';
import type { ListSubscriptionsResult } from '../provider.interface';
import type {
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreateCustomerOptions,
  Customer,
  CheckoutSessionInfo,
  SubscriptionStatusFilter,
} from '../../types/payment.types';

export const STRIPE_PROVIDER_NAME = 'stripe';

export class StripePaymentProvider implements PaymentProvider {
  readonly name = STRIPE_PROVIDER_NAME;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string | undefined;

  constructor(options: StripeProviderOptions) {
    const secretKey = options.secretKey ?? process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        'Stripe secret key is required. Set STRIPE_SECRET_KEY or pass secretKey in StripeProviderOptions.'
      );
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: options.apiVersion,
    });
    this.webhookSecret = options.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  }

  /** Raw Stripe client for advanced usage. */
  getClient(): Stripe {
    return this.stripe;
  }

  async createCheckoutSession(
    options: CreateCheckoutSessionOptions
  ): Promise<CreateCheckoutSessionResult> {
    const mode: 'payment' | 'subscription' =
      options.mode ?? (options.subscription ? 'subscription' : 'payment');
    const stripeOptions = (options.providerOptions?.stripe ??
      {}) as Partial<Stripe.Checkout.SessionCreateParams>;

    const params: Stripe.Checkout.SessionCreateParams = {
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      mode,
      ...(options.clientReferenceId && { client_reference_id: options.clientReferenceId }),
      ...(options.customerId && { customer: options.customerId }),
      ...(options.customerEmail &&
        !options.customerId && { customer_email: options.customerEmail }),
      ...(options.allowPromotionCodes && { allow_promotion_codes: true }),
      ...stripeOptions,
    };

    if (mode === 'subscription' && options.subscription) {
      params.line_items = [
        {
          price: options.subscription.priceId,
          quantity: options.subscription.quantity ?? 1,
        },
      ];
      if (options.subscription.trialPeriodDays) {
        params.subscription_data = {
          trial_period_days: options.subscription.trialPeriodDays,
        };
      }
    } else if (options.lineItems && options.lineItems.length > 0) {
      params.line_items = options.lineItems.map((item) => {
        if (item.priceId) {
          return { price: item.priceId, quantity: item.quantity ?? 1 };
        }
        if (item.priceData) {
          return {
            price_data: {
              currency: item.priceData.currency,
              unit_amount: item.priceData.unitAmount,
              product_data: {
                name: item.priceData.productData.name,
                description: item.priceData.productData.description,
                images: item.priceData.productData.images,
              },
            },
            quantity: item.quantity ?? 1,
          };
        }
        throw new Error('Each line item must have priceId or priceData');
      });
    }

    const session = await this.stripe.checkout.sessions.create(params);
    return { sessionId: session.id, url: session.url ?? null };
  }

  async createCustomer(options: CreateCustomerOptions): Promise<Customer> {
    const customer = await this.stripe.customers.create({
      email: options.email,
      name: options.name,
      metadata: options.metadata,
    });
    return this.toCustomer(customer);
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const customer = await this.stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return this.toCustomer(customer);
  }

  async listSubscriptions(
    customerId: string,
    status?: SubscriptionStatusFilter
  ): Promise<ListSubscriptionsResult> {
    const list = await this.stripe.subscriptions.list({
      customer: customerId,
      status: status ?? 'all',
      expand: ['data.items.data.price'],
    });
    return {
      data: list.data.map((s) => ({
        ...s,
        id: s.id,
        status: s.status,
        customerId: s.customer as string,
      })),
    };
  }

  async getCheckoutSession(sessionId: string): Promise<CheckoutSessionInfo> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });
    return {
      ...session,
      id: session.id,
      url: session.url ?? null,
      customerId:
        typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
      subscriptionId:
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription?.id ?? null),
      status: session.status ?? undefined,
    } as CheckoutSessionInfo;
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  parseWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new Error(
        'Stripe webhook secret is required. Set STRIPE_WEBHOOK_SECRET or pass webhookSecret in StripeProviderOptions.'
      );
    }
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret
    ) as Stripe.Event;
  }

  private toCustomer(c: Stripe.Customer): Customer {
    return {
      id: c.id,
      email: c.email ?? null,
      name: c.name ?? null,
      metadata: c.metadata as Record<string, string> | undefined,
    };
  }
}
