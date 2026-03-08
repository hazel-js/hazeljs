/**
 * Provider-agnostic payment types for @hazeljs/payment.
 */

/**
 * Generic customer returned by any provider.
 */
export interface Customer {
  id: string;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, string>;
}

/**
 * Generic subscription list item.
 */
export interface Subscription {
  id: string;
  status: string;
  customerId: string;
  [key: string]: unknown;
}

/**
 * Generic checkout session info (e.g. after redirect).
 */
export interface CheckoutSessionInfo {
  id: string;
  url: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string;
  [key: string]: unknown;
}

/**
 * Provider-agnostic options for creating a checkout session (one-time or subscription).
 * Provider-specific extras go in providerOptions[providerName].
 */
export interface CreateCheckoutSessionOptions {
  /** Success URL after payment. */
  successUrl: string;
  /** Cancel URL when user cancels. */
  cancelUrl: string;
  /** Existing provider customer ID. */
  customerId?: string;
  /** Customer email (for new customer). */
  customerEmail?: string;
  /** Client reference (e.g. user id, order id). */
  clientReferenceId?: string;
  /** One-time payment: line items (price id or custom amount). */
  lineItems?: Array<{
    priceId?: string;
    quantity?: number;
    priceData?: {
      currency: string;
      unitAmount: number;
      productData: { name: string; description?: string; images?: string[] };
    };
  }>;
  /** Subscription: price ID and optional trial. */
  subscription?: {
    priceId: string;
    quantity?: number;
    trialPeriodDays?: number;
  };
  /** Allow promotion codes (when supported by provider). */
  allowPromotionCodes?: boolean;
  /** Mode: 'payment' (one-time) or 'subscription'. Inferred from subscription if not set. */
  mode?: 'payment' | 'subscription';
  /** Provider-specific options, e.g. { stripe: { ... } }. */
  providerOptions?: Record<string, unknown>;
}

/**
 * Result of creating a checkout session.
 */
export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string | null;
}

/**
 * Options for creating a customer.
 */
export interface CreateCustomerOptions {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

/**
 * Subscription status filter for listSubscriptions.
 */
export type SubscriptionStatusFilter =
  | 'active'
  | 'canceled'
  | 'incomplete_expired'
  | 'unpaid'
  | 'all';
