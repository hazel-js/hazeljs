/**
 * @hazeljs/payment - Multi-provider payment integration for HazelJS (Stripe, and more).
 */

export { PaymentModule } from './payment.module';
export type { PaymentModuleOptions } from './payment.module';
export { PaymentService } from './payment.service';
export { PaymentController } from './payment.controller';

export type {
  Customer,
  Subscription,
  CheckoutSessionInfo,
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreateCustomerOptions,
  SubscriptionStatusFilter,
} from './types/payment.types';

export type { PaymentProvider, ListSubscriptionsResult } from './providers/provider.interface';
export { StripePaymentProvider, STRIPE_PROVIDER_NAME } from './providers/stripe/stripe.provider';
export type { StripeProviderOptions, StripeWebhookEvent } from './providers/stripe/stripe.types';
