# @hazeljs/payment

**Multi-provider payment integration for HazelJS.** Use Stripe today; plug in PayPal, Paddle, or your own provider with one interface.

[![npm version](https://img.shields.io/npm/v/@hazeljs/payment.svg)](https://www.npmjs.com/package/@hazeljs/payment)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Provider-agnostic API** — Same methods for checkout, customers, subscriptions, and webhooks across providers
- **Stripe included** — First-class Stripe support via `StripePaymentProvider`
- **Extensible** — Implement `PaymentProvider` to add PayPal, Paddle, or custom gateways
- **Optional controller** — `POST /payment/checkout-session` and `POST /payment/webhook/:provider`

## Installation

```bash
pnpm add @hazeljs/payment
```

For Stripe, set (or pass in code):

- `STRIPE_SECRET_KEY` — e.g. `sk_test_...` or `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — e.g. `whsec_...` for webhook verification

## Quick Start (Stripe)

### 1. Register the module

```typescript
import { HazelApp } from '@hazeljs/core';
import { PaymentModule } from '@hazeljs/payment';

const app = new HazelApp({
  modules: [
    PaymentModule.forRoot({
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
    }),
  ],
});
```

### 2. Create a checkout session

```typescript
import { PaymentService } from '@hazeljs/payment';

const result = await paymentService.createCheckoutSession({
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel',
  customerEmail: 'user@example.com',
  clientReferenceId: userId,
  lineItems: [
    {
      priceData: {
        currency: 'usd',
        unitAmount: 1999,
        productData: { name: 'Premium Plan', description: 'Monthly access' },
      },
      quantity: 1,
    },
  ],
});

// Redirect user to result.url
```

### 3. Subscriptions

```typescript
const result = await paymentService.createCheckoutSession({
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel',
  customerId: stripeCustomerId,
  subscription: {
    priceId: 'price_xxx',
    quantity: 1,
    trialPeriodDays: 14,
  },
});
```

### 4. Customers

```typescript
const customer = await paymentService.createCustomer({
  email: 'user@example.com',
  name: 'Jane Doe',
  metadata: { userId: 'your-internal-id' },
});
```

### 5. Webhooks

The controller exposes **POST /payment/webhook/:provider** (e.g. `POST /payment/webhook/stripe`). Use the **raw request body** for signature verification.

Handle events in your app:

```typescript
const event = paymentService.parseWebhookEvent('stripe', req.rawBody, req.headers['stripe-signature']);
if (event && typeof event === 'object' && 'type' in event) {
  switch ((event as { type: string }).type) {
    case 'checkout.session.completed':
      // Fulfill order, grant access
      break;
    case 'customer.subscription.updated':
      // Update subscription in your DB
      break;
  }
}
```

For Stripe you can type the event:

```typescript
import type { StripeWebhookEvent } from '@hazeljs/payment';

const event = paymentService.parseWebhookEvent('stripe', body, sig) as StripeWebhookEvent;
```

## Multiple providers

Register Stripe and custom providers, and optionally set a default:

```typescript
import { PaymentModule, StripePaymentProvider, type PaymentProvider } from '@hazeljs/payment';

// Custom provider (see "Adding a new provider" below)
const myProvider: PaymentProvider = new MyPaymentProvider(config);

PaymentModule.forRoot({
  defaultProvider: 'stripe',
  stripe: { secretKey: '...', webhookSecret: '...' },
  providers: {
    mygateway: myProvider,
  },
});
```

Use a specific provider when creating a session or handling webhooks:

```typescript
await paymentService.createCheckoutSession(options, 'stripe');
await paymentService.createCheckoutSession(options, 'mygateway');

// Webhook URL: POST /payment/webhook/stripe or POST /payment/webhook/mygateway
```

Stripe-specific API (e.g. raw Stripe client):

```typescript
import { PaymentService, StripePaymentProvider, STRIPE_PROVIDER_NAME } from '@hazeljs/payment';

const stripe = paymentService.getProvider<StripePaymentProvider>(STRIPE_PROVIDER_NAME);
const client = stripe.getClient(); // Stripe SDK instance
```

## Adding a new provider

Implement the `PaymentProvider` interface and register it in `forRoot({ providers: { name: instance } })`:

```typescript
import type { PaymentProvider } from '@hazeljs/payment';
import type {
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreateCustomerOptions,
  Customer,
  CheckoutSessionInfo,
  SubscriptionStatusFilter,
} from '@hazeljs/payment';

export class MyPaymentProvider implements PaymentProvider {
  readonly name = 'mygateway';

  async createCheckoutSession(options: CreateCheckoutSessionOptions): Promise<CreateCheckoutSessionResult> {
    // Call your gateway API, return { sessionId, url }.
  }

  async createCustomer(options: CreateCustomerOptions): Promise<Customer> {
    // Create customer in gateway; return { id, email, name?, metadata? }.
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    // Retrieve and map to Customer.
  }

  async listSubscriptions(customerId: string, status?: SubscriptionStatusFilter) {
    // Return { data: Subscription[] }.
  }

  async getCheckoutSession(sessionId: string): Promise<CheckoutSessionInfo> {
    // Return { id, url, customerId?, subscriptionId?, status? }.
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  parseWebhookEvent(payload: string | Buffer, signature: string): unknown {
    // Verify signature and return parsed event.
  }
}
```

## API summary

| Method | Description |
|--------|-------------|
| `createCheckoutSession(options, provider?)` | Create checkout session; returns `{ sessionId, url }` |
| `createCustomer(options, provider?)` | Create a customer |
| `getCustomer(customerId, provider?)` | Retrieve a customer |
| `listSubscriptions(customerId, status?, provider?)` | List subscriptions |
| `getCheckoutSession(sessionId, provider?)` | Retrieve session (e.g. after redirect) |
| `parseWebhookEvent(providerName, payload, signature)` | Verify and parse webhook event |
| `getProvider(name)` | Get provider instance (e.g. for Stripe client) |
| `getProviderNames()` | List registered provider names |

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
