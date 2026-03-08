/**
 * Payment provider interface. Implement this to add new payment methods (Stripe, PayPal, Paddle, etc.).
 */

import type {
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreateCustomerOptions,
  Customer,
  CheckoutSessionInfo,
  Subscription,
  SubscriptionStatusFilter,
} from '../types/payment.types';

export interface ListSubscriptionsResult {
  data: Subscription[];
}

/**
 * Implement this interface to add a payment provider to @hazeljs/payment.
 */
export interface PaymentProvider {
  /** Provider identifier (e.g. 'stripe', 'paypal'). */
  readonly name: string;

  /** Create a checkout session; returns URL to redirect the customer. */
  createCheckoutSession(
    options: CreateCheckoutSessionOptions
  ): Promise<CreateCheckoutSessionResult>;

  /** Create a customer in the provider's system. */
  createCustomer(options: CreateCustomerOptions): Promise<Customer>;

  /** Retrieve a customer by ID. */
  getCustomer(customerId: string): Promise<Customer | null>;

  /** List subscriptions for a customer. */
  listSubscriptions(
    customerId: string,
    status?: SubscriptionStatusFilter
  ): Promise<ListSubscriptionsResult>;

  /** Retrieve a checkout session (e.g. after success redirect). */
  getCheckoutSession(sessionId: string): Promise<CheckoutSessionInfo>;

  /** Whether webhook verification is configured for this provider. */
  isWebhookConfigured(): boolean;

  /**
   * Verify and parse a webhook event from raw body and signature.
   * Returns provider-specific event object. Throws if signature invalid or not configured.
   */
  parseWebhookEvent(payload: string | Buffer, signature: string): unknown;
}
