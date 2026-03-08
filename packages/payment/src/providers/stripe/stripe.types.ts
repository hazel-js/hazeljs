/**
 * Stripe-specific configuration and types.
 */

import type Stripe from 'stripe';

export interface StripeProviderOptions {
  /** Secret key (e.g. sk_test_...). Defaults to process.env.STRIPE_SECRET_KEY. */
  secretKey?: string;
  /** Webhook signing secret (e.g. whsec_...). Defaults to process.env.STRIPE_WEBHOOK_SECRET. */
  webhookSecret?: string;
  /** Optional Stripe API version. */
  apiVersion?: Stripe.LatestApiVersion;
}

/** Re-export Stripe Event for webhook handlers. */
export type StripeWebhookEvent = Stripe.Event;
