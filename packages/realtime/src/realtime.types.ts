/**
 * @hazeljs/realtime - Shared types for real-time voice AI
 */

/**
 * Supported real-time voice providers
 */
export type RealtimeProvider = 'openai' | 'gemini';

/**
 * OpenAI Realtime voice options
 */
export type OpenAIVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

/**
 * Audio format for real-time sessions
 */
export interface RealtimeAudioFormat {
  type: 'audio/pcm' | 'audio/pcmu' | 'audio/pcma';
  rate?: 8000 | 16000 | 24000;
}

/**
 * Session configuration for real-time voice
 */
export interface RealtimeSessionConfig {
  /** System instructions for the model */
  instructions?: string;
  /** Voice for audio output (OpenAI) */
  voice?: OpenAIVoice;
  /** Output modalities: audio, text, or both */
  outputModalities?: ('audio' | 'text')[];
  /** Audio input format */
  inputFormat?: RealtimeAudioFormat;
  /** Audio output format */
  outputFormat?: RealtimeAudioFormat;
  /** Enable turn detection (VAD) - when disabled, use manual commit */
  turnDetection?: boolean;
  /** Model to use (OpenAI: gpt-realtime) */
  model?: string;
}

/**
 * OpenAI Realtime API client event (client → server)
 */
export interface RealtimeClientEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * OpenAI Realtime API server event (server → client)
 */
export interface RealtimeServerEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Realtime session lifecycle events
 */
export type RealtimeSessionEvent =
  | 'session.created'
  | 'session.updated'
  | 'session.ended'
  | 'error'
  | 'response.output_audio.delta'
  | 'response.output_audio.done'
  | 'response.output_text.delta'
  | 'response.output_text.done'
  | 'response.done'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped';

/**
 * Realtime module options
 */
export interface RealtimeModuleOptions {
  /** Default provider */
  defaultProvider?: RealtimeProvider;
  /** OpenAI API key (or use OPENAI_API_KEY env) */
  openaiApiKey?: string;
  /** WebSocket path for realtime endpoint */
  path?: string;
  /** Default session config */
  defaultSessionConfig?: RealtimeSessionConfig;
}

/**
 * Realtime session stats
 */
export interface RealtimeSessionStats {
  sessionId: string;
  provider: RealtimeProvider;
  connectedAt: number;
  audioChunksReceived: number;
  audioChunksSent: number;
  eventsReceived: number;
  eventsSent: number;
}
