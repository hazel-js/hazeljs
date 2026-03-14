/**
 * @hazeljs/realtime - Real-time voice AI for HazelJS
 *
 * Low-latency speech-to-speech with OpenAI Realtime API.
 * Connect via WebSocket at /realtime for voice conversations.
 *
 * @example
 * ```ts
 * import { HazelApp } from '@hazeljs/core';
 * import { RealtimeModule } from '@hazeljs/realtime';
 *
 * const app = new HazelApp(AppModule);
 * await app.listen(3000);
 * // RealtimeGateway is auto-attached via OnApplicationBootstrap
 * ```
 */

export { RealtimeModule } from './realtime.module';
export { RealtimeService } from './realtime.service';
export { RealtimeGateway } from './realtime.gateway';
export { OpenAIRealtimeClient, OpenAIRealtimeSession } from './providers/openai';
export type {
  RealtimeProvider,
  RealtimeSessionConfig,
  RealtimeModuleOptions,
  RealtimeSessionStats,
  OpenAIVoice,
  RealtimeClientEvent,
  RealtimeServerEvent,
} from './realtime.types';
