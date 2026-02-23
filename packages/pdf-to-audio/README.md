# @hazeljs/pdf-to-audio

Convert PDF documents to audio using OpenAI TTS. Extracts text from PDFs, chunks it, generates speech per chunk, and merges the audio.

## Installation

```bash
npm install @hazeljs/pdf-to-audio @hazeljs/core @hazeljs/ai @hazeljs/queue @hazeljs/rag ioredis
```

**Note:** Requires Redis for the job queue. Start Redis before using PDF-to-audio.

## Usage

### Module (REST API)

```ts
import { HazelApp } from '@hazeljs/core';
import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';

const app = new HazelApp({
  module: YourAppModule,
});

// In your app module (use forRoot with Redis connection):
import { HazelModule } from '@hazeljs/core';
import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';

@HazelModule({
  imports: [
    PdfToAudioModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      outputDir: './data/pdf-to-audio', // optional, default: ./data/pdf-to-audio
    }),
  ],
})
export class AppModule {}
```

**Endpoints (async job-based):**

1. `POST /api/pdf-to-audio/convert` — Submit PDF, returns `{ jobId }` (202)
   - Content-Type: `multipart/form-data`
   - Field: `file` (PDF file)
   - Optional: `includeSummary` = `"false"`, `summaryOnly` = `"true"`, `voice` = `"alloy"` etc.

2. `GET /api/pdf-to-audio/status/:jobId` — Check job status (`pending`, `processing`, `completed`, `failed`)

3. `GET /api/pdf-to-audio/download/:jobId` — Download MP3 when job is completed (reads from disk; files stored in `outputDir`)

### Service (programmatic)

```ts
import { PdfToAudioService } from '@hazeljs/pdf-to-audio';
import { OpenAIProvider } from '@hazeljs/ai';

const provider = new OpenAIProvider();
const service = new PdfToAudioService(provider);
const audioBuffer = await service.convert(pdfBuffer, { voice: 'alloy', model: 'tts-1' });
```

### CLI

Requires a running API server. Uses async job flow: submit → poll status → download.

```bash
# Submit job and wait for completion, then save to output
hazel pdf-to-audio convert document.pdf --api-url http://localhost:3000 --wait -o audio.mp3

# Submit only (returns job ID)
hazel pdf-to-audio convert document.pdf --api-url http://localhost:3000

# Check status and download when ready
hazel pdf-to-audio status <jobId> --api-url http://localhost:3000 -o audio.mp3
```

## Environment

- `OPENAI_API_KEY` — Required for TTS

## Options

| Option | Description | Default |
|--------|-------------|---------|
| voice | TTS voice (alloy, echo, fable, onyx, nova, shimmer) | alloy |
| model | TTS model (tts-1, tts-1-hd) | tts-1 |
| format | Output format (mp3, opus) | mp3 |
| includeSummary | Include AI-generated document summary at the start of the audio | true |
| summaryOnly | Output only the summary—do not read the full document | false |
