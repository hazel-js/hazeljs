# @hazeljs/guardrails

**Content safety, PII handling, and output validation for HazelJS AI applications.**

[![npm version](https://img.shields.io/npm/v/@hazeljs/guardrails.svg)](https://www.npmjs.com/package/@hazeljs/guardrails)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/guardrails)](https://www.npmjs.com/package/@hazeljs/guardrails)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Why Guardrails?

AI applications face unique security challenges: prompt injection, PII leakage, toxic output. Unlike LangChain or Vercel AI SDK, HazelJS provides **built-in guardrails** that plug into HTTP, AI, and agent layers—no separate middleware.

## Features

- **PII Detection & Redaction** — Email, phone, SSN, credit card (configurable entities)
- **Prompt Injection Detection** — Heuristic patterns (e.g. "ignore previous instructions", "jailbreak")
- **Toxicity Check** — Keyword blocklist for harmful content
- **Output Validation** — Schema validation and PII redaction on LLM responses
- **HTTP Integration** — GuardrailPipe and GuardrailInterceptor for routes
- **AI Integration** — @GuardrailInput and @GuardrailOutput decorators for @AITask
- **Agent Integration** — Automatic input/output guardrails for @hazeljs/agent tools

## Installation

```bash
npm install @hazeljs/guardrails
```

Or with the HazelJS CLI:

```bash
hazel add guardrails
```

## Quick Start

### 1. Import the Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { GuardrailsModule } from '@hazeljs/guardrails';

@HazelModule({
  imports: [
    GuardrailsModule.forRoot({
      redactPIIByDefault: true,
      blockInjectionByDefault: true,
      blockToxicityByDefault: true,
    }),
  ],
})
export class AppModule {}
```

### 2. Use with HTTP Routes

**GuardrailPipe** — Validate request body:

```typescript
import { Controller, Post, Body, UsePipes } from '@hazeljs/core';
import { GuardrailPipe } from '@hazeljs/guardrails';

@Controller({ path: '/chat' })
export class ChatController {
  @Post()
  @UsePipes(GuardrailPipe)
  async chat(@Body() body: { message: string }) {
    return { reply: '...' };
  }
}
```

**GuardrailInterceptor** — Validate input and output:

```typescript
import { Controller, UseInterceptors } from '@hazeljs/core';
import { GuardrailInterceptor } from '@hazeljs/guardrails';

@Controller({ path: '/chat' })
@UseInterceptors(GuardrailInterceptor)
export class ChatController {
  @Post()
  async chat(@Body() body: { message: string }) {
    return { reply: '...' };
  }
}
```

### 3. Use with @AITask

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { AIService, AITask } from '@hazeljs/ai';
import { GuardrailsService, GuardrailInput, GuardrailOutput } from '@hazeljs/guardrails';

@Controller({ path: '/chat' })
export class ChatController {
  constructor(private aiService: AIService, private guardrailsService: GuardrailsService) {}

  @GuardrailInput()
  @GuardrailOutput()
  @AITask({ provider: 'openai', model: 'gpt-4' })
  @Post()
  async chat(@Body() body: { message: string }) {
    return body.message;
  }
}
```

### 4. Use with @hazeljs/agent

When both `GuardrailsModule` and `AgentModule` are imported, tool input and output are automatically validated:

```typescript
@HazelModule({
  imports: [
    GuardrailsModule.forRoot(),
    AgentModule.forRoot(),
  ],
})
export class AppModule {}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `piiEntities` | `PIIEntityType[]` | `['email','phone','ssn','credit_card']` | Entities to detect/redact |
| `redactPIIByDefault` | `boolean` | `false` | Redact PII in input by default |
| `blockInjectionByDefault` | `boolean` | `true` | Block prompt injection by default |
| `blockToxicityByDefault` | `boolean` | `true` | Block toxic content by default |
| `injectionBlocklist` | `string[]` | — | Custom injection patterns |
| `toxicityBlocklist` | `string[]` | — | Custom toxicity keywords |

## API

### GuardrailsService

- `checkInput(input, options?)` — Validate input, returns `{ allowed, modified?, violations? }`
- `checkOutput(output, options?)` — Validate output, returns `{ allowed, modified?, violations? }`
- `redactPII(text, entities?)` — Redact PII from text

### GuardrailViolationError

Thrown when content is blocked. Includes `violations` and `blockedReason`. Use an Exception Filter to map to HTTP 400.

### Use Cases

- **Customer support chatbot** — Block injection, redact PII, validate responses
- **Internal AI tools** — Ensure agent tools don't leak sensitive data
- **Public chat API** — GuardrailPipe on `/chat` to reject toxic or injection attempts
- **Compliance** — PII redaction for GDPR/CCPA, documented controls for audits

## Learn More

- [Documentation](https://hazeljs.com/docs/packages/guardrails)
- [@hazeljs/ai](https://hazeljs.com/docs/packages/ai) — AI integration
- [@hazeljs/agent](https://hazeljs.com/docs/packages/agent) — Agent runtime
