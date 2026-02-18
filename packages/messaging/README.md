# @hazeljs/messaging

Multichannel messaging for HazelJS: WhatsApp, Telegram, Viber with LLM-powered bot responses.

## Features

- **Channel adapters** – Telegram (Telegraf), WhatsApp Cloud API, Viber (optional)
- **Unified message format** – Channel-agnostic `IncomingMessage` / `OutgoingMessage`
- **LLM integration** – Uses `@hazeljs/ai` providers (OpenAI, Anthropic, etc.) for conversational responses
- **Conversation context** – Memory (dev) or **Redis** (production, horizontally scalable)
- **Kafka processing** – Optional async flow for horizontally scalable message handling
- **Webhook controller** – Single endpoint per channel for incoming messages

## Installation

```bash
npm install @hazeljs/messaging @hazeljs/ai @hazeljs/core
```

For **Redis context** (horizontal scaling):

```bash
npm install ioredis
```

For **Kafka async processing** (horizontal scaling):

```bash
npm install @hazeljs/kafka
```

For Viber support:

```bash
npm install viber-bot
```

## Quick Start

```typescript
import { HazelApp } from '@hazeljs/core';
import { MessagingModule } from '@hazeljs/messaging';
import { OpenAIProvider } from '@hazeljs/ai';

const app = new HazelApp({
  imports: [
    MessagingModule.forRoot({
      aiProvider: new OpenAIProvider(process.env.OPENAI_API_KEY),
      systemPrompt: 'You are a helpful support assistant. Keep responses concise.',
      model: 'gpt-4o-mini',
      channels: {
        telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN! },
        whatsapp: {
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
        },
      },
    }),
  ],
});

app.listen(3000);
```

## Scalable Configuration (Redis + Kafka)

For horizontal scalability, use Redis for context and Kafka for async processing:

```typescript
import Redis from 'ioredis';

MessagingModule.forRoot({
  aiProvider: new OpenAIProvider(),
  channels: { telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN! } },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttlSeconds: 86400, // 24h
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  },
});
```

- **Redis**: Stores conversation history; any instance can serve any session.
- **Kafka**: Webhook returns 200 immediately; consumers process messages asynchronously (scale workers independently).

## Webhook URLs

| Channel   | Method | URL                              |
|-----------|--------|----------------------------------|
| Telegram  | POST   | `/api/messaging/webhook/telegram` |
| WhatsApp  | GET    | `/api/messaging/webhook/whatsapp` (verification) |
| WhatsApp  | POST   | `/api/messaging/webhook/whatsapp` |
| Viber     | POST   | `/api/messaging/webhook/viber`    |

## Configuration

### MessagingModuleOptions

- `aiProvider` – `IAIProvider` from `@hazeljs/ai` (e.g. `OpenAIProvider`)
- `systemPrompt` – System prompt for the LLM
- `model` – Model name (default: `gpt-4o-mini`)
- `temperature` – 0–1 (default: 0.7)
- `maxTokens` – Max response tokens (default: 500)
- `maxContextTurns` – Conversation turns to keep (default: 10)
- `customHandler` – Override LLM with a custom `(msg) => string | Promise<string>`
- `channels` – Channel config (see below)

### WhatsApp

- Requires [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api) access
- Set `WHATSAPP_VERIFY_TOKEN` in env for webhook verification
- `accessToken`, `phoneNumberId` from Meta for Developers

### Telegram

- Create a bot via [@BotFather](https://t.me/BotFather)
- Set webhook: `https://api.telegram.org/bot<token>/setWebhook?url=https://your-domain/api/messaging/webhook/telegram`

### Viber

- Create a bot on [Viber Developers](https://developers.viber.com)
- Install optional peer: `npm install viber-bot`

## RAG and Agent Integration

### RAG-augmented responses

Use a knowledge base to ground responses. Compatible with `@hazeljs/rag` RAGService:

```typescript
import { RAGService } from '@hazeljs/rag';
// ... set up RAGService with vector store, embeddings, etc.

MessagingModule.forRoot({
  aiProvider: new OpenAIProvider(),
  ragService: myRAGService,
  ragTopK: 5,
  ragMinScore: 0.5,
  channels: { telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN! } },
});
```

### Agent handler (CSR-style: tools, RAG, external APIs)

Wire your CSRService or AgentRuntime for full control—tools, RAG, external lookups:

```typescript
import { MessagingModule } from '@hazeljs/messaging';
import { CSRService } from './csr'; // your CSRService like hazeljs-csr-example

const csrService = new CSRService(...);

MessagingModule.forRoot({
  agentHandler: async ({ message, sessionId }) => {
    const result = await csrService.chat(message.text, sessionId, message.userId);
    return { response: result.response, sources: result.sources };
  },
  channels: { telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN! } },
});
```

The agent handler receives `{ message, sessionId, conversationTurns }` and can:
- Call `AgentRuntime.execute()` with tools and RAG
- Use external services (orders, inventory, tickets)
- Return `string` or `{ response, sources }`

## Extending

### Custom handler

```typescript
MessagingModule.forRoot({
  customHandler: async (msg) => {
    if (msg.text === '/help') return 'Available commands: /help, /status';
    return 'Use /help for commands.';
  },
});
```

### Custom adapter

Implement `IChannelAdapter` and register via providers.
