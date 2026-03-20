# @hazeljs/realtime

**Voice AI, the HazelJS way.**

Low-latency speech-to-speech with OpenAI Realtime API. Connect via WebSocket for voice conversations with sub-second latency — no separate STT → LLM → TTS pipeline.

[![npm version](https://img.shields.io/npm/v/@hazeljs/realtime.svg)](https://www.npmjs.com/package/@hazeljs/realtime)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/realtime)](https://www.npmjs.com/package/@hazeljs/realtime)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🎙️ **Speech-to-Speech** — Native voice in, voice out — no intermediate text step
- ⚡ **Low Latency** — Sub-second response via WebSocket to OpenAI Realtime API
- 🔌 **WebSocket** — Built on @hazeljs/websocket with @Realtime decorator
- 🎛️ **Configurable** — Instructions, voice, output modalities per session
- 🔄 **Bidirectional** — Proxy client ↔ OpenAI; send audio, receive audio + text
- 📡 **Event-Driven** — Forward any OpenAI Realtime client/server events

---

## Installation

```bash
npm install @hazeljs/realtime @hazeljs/core @hazeljs/websocket
```

### Environment

Set `OPENAI_API_KEY` or pass `openaiApiKey` in `RealtimeModule.forRoot()`.

---

## Quick Start

### 1. Register Realtime Module

```typescript
// app.module.ts
import { HazelModule } from '@hazeljs/core';
import { RealtimeModule } from '@hazeljs/realtime';

@HazelModule({
  imports: [
    RealtimeModule.forRoot({
      openaiApiKey: process.env.OPENAI_API_KEY,
      path: '/realtime',
      defaultSessionConfig: {
        instructions: 'You are a helpful voice assistant. Speak clearly and briefly.',
        voice: 'marin',
        outputModalities: ['audio', 'text'],
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Bootstrap

```typescript
// main.ts
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  const port = parseInt(process.env.PORT ?? '3000', 10);

  await app.listen(port);

  console.log(`Realtime voice AI at ws://localhost:${port}/realtime`);
}

bootstrap().catch(console.error);
```

The RealtimeGateway is automatically attached to the HTTP server when the app starts listening (via `OnApplicationBootstrap`).

For advanced use cases (e.g. custom HTTP server, attaching to a different port), you can still attach manually:

```typescript
import { RealtimeGateway } from '@hazeljs/realtime';

const server = app.getServer();
const gateway = app.getContainer().resolve(RealtimeGateway);
if (server && gateway) gateway.attachToServer(server);
```

### 3. Connect from Client

```javascript
const ws = new WebSocket('ws://localhost:3000/realtime');

ws.onopen = () => {
  // Optional: update session config
  ws.send(JSON.stringify({
    type: 'session.update',
    session: { instructions: 'Be extra friendly!' },
  }));
};

ws.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);
  if (event === 'realtime') {
    if (data.type === 'response.output_audio.delta') {
      // Play base64 PCM: data.delta
    }
  }
};

// Send audio (base64 PCM 24kHz)
ws.send(JSON.stringify({
  type: 'input_audio_buffer.append',
  audio: base64PcmChunk,
}));
```

---

## Configuration

### RealtimeModule.forRoot(options)

| Option | Type | Description |
|--------|------|-------------|
| `openaiApiKey` | string | OpenAI API key (or use `OPENAI_API_KEY` env) |
| `path` | string | WebSocket path (default: `/realtime`) |
| `defaultSessionConfig` | RealtimeSessionConfig | Default session config |
| `defaultProvider` | 'openai' \| 'gemini' | Provider (OpenAI supported first) |

### RealtimeSessionConfig

| Option | Type | Description |
|--------|------|-------------|
| `instructions` | string | System prompt for the model |
| `voice` | OpenAIVoice | alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar |
| `outputModalities` | ('audio' \| 'text')[] | Output modes (default: ['audio', 'text']) |
| `inputFormat` | RealtimeAudioFormat | PCM format (default: 24kHz) |
| `turnDetection` | boolean | Enable VAD (default: true) |

---

## Client Events

Send any [OpenAI Realtime client event](https://platform.openai.com/docs/api-reference/realtime-client-events) over the WebSocket:

| Event | Description |
|-------|-------------|
| `session.update` | Update session config |
| `input_audio_buffer.append` | Send base64 PCM audio |
| `input_audio_buffer.commit` | Commit buffer (when VAD disabled) |
| `input_audio_buffer.clear` | Clear buffer |
| `conversation.item.create` | Add text message |
| `response.create` | Trigger model response |

---

## Server Events

You receive `{ event: 'realtime', data: <OpenAI server event> }`:

| Event | Description |
|-------|-------------|
| `session.created` / `session.updated` | Session lifecycle |
| `response.output_audio.delta` | Audio chunk (base64) |
| `response.output_audio.done` | Audio complete |
| `response.output_text.delta` / `response.output_text.done` | Text stream |
| `response.done` | Response complete |
| `input_audio_buffer.speech_started` / `speech_stopped` | VAD events |

---

## Audio Format

- **Input**: PCM 16-bit, 24kHz (or 8kHz for telephony)
- **Output**: PCM 16-bit, 24kHz

Encode/decode base64 for transport over WebSocket.

---

## Use Cases

- 🎙️ **Voice Assistants** — Hands-free, low-latency voice interfaces
- 📞 **Call Centers** — Real-time AI agents with natural speech
- ♿ **Accessibility** — Voice-first interfaces
- 🤖 **Robotics** — Voice control for devices
- 🎮 **Gaming** — In-game voice NPCs

---

## API Reference

### RealtimeGateway

```typescript
class RealtimeGateway extends WebSocketGateway {
  constructor(realtimeService: RealtimeService, options?: RealtimeGatewayOptions);
  attachToServer(server: HttpServer, options?: { path?: string; maxPayload?: number }): WebSocketServer;
}
```

### RealtimeService

```typescript
class RealtimeService {
  createOpenAISession(client: RealtimeClientAdapter, overrides?: {...}): Promise<OpenAIRealtimeSession>;
  getSession(clientId: string): OpenAIRealtimeSession | undefined;
  removeSession(clientId: string): void;
  getStats(): RealtimeSessionStats[];
}
```

---

## Testing

```bash
npm test
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

---

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

---

## Links

- [Documentation](https://hazeljs.ai/docs/packages/realtime)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/rnxaDcXx)
