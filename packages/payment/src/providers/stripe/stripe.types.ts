/**
 * Stripe-specific configuration and types.
 */

import type Stripe from 'stripe';

type StripeClient = InstanceType<typeof Stripe>;

export interface StripeProviderOptions {
  /** Secret key (e.g. sk_test_...). Defaults to process.env.STRIPE_SECRET_KEY. */
  secretKey?: string;
  /** Webhook signing secret (e.g. whsec_...). Defaults to process.env.STRIPE_WEBHOOK_SECRET. */
  webhookSecret?: string;
  /** Optional Stripe API version. */
  apiVersion?: NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion'];
}

/** Re-export Stripe Event for webhook handlers. */
export type StripeWebhookEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;
