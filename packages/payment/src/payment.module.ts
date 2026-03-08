import { HazelModule } from '@hazeljs/core';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import type { PaymentProvider } from './providers/provider.interface';
import { StripePaymentProvider, STRIPE_PROVIDER_NAME } from './providers/stripe/stripe.provider';
import type { StripeProviderOptions } from './providers/stripe/stripe.types';

/**
 * Options for PaymentModule.forRoot().
 * Register providers via convenience keys (e.g. stripe) and/or pass pre-built provider instances.
 */
export interface PaymentModuleOptions {
  /** Provider to use when none is specified (default: first registered). */
  defaultProvider?: string;
  /** Convenience: Stripe config; we create StripePaymentProvider. */
  stripe?: StripeProviderOptions;
  /** Additional or custom provider instances (merged with convenience providers). */
  providers?: Record<string, PaymentProvider>;
}

/**
 * Payment module for Stripe, and other providers. Register with forRoot().
 */
@HazelModule({
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {
  static forRoot(options: PaymentModuleOptions): typeof PaymentModule {
    const providers: Record<string, PaymentProvider> = {
      ...(options.providers ?? {}),
    };
    if (options.stripe) {
      providers[STRIPE_PROVIDER_NAME] = new StripePaymentProvider(options.stripe);
    }
    PaymentService.configure({
      defaultProvider: options.defaultProvider,
      providers,
    });
    return PaymentModule;
  }
}
