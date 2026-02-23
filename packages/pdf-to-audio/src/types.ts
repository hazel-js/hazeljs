/**
 * PDF-to-Audio conversion options
 */
export interface PdfToAudioOptions {
  /** Voice for TTS (e.g. alloy, echo, fable, onyx, nova, shimmer) */
  voice?: string;
  /** TTS model (e.g. tts-1, tts-1-hd) */
  model?: string;
  /** Output format: mp3 or opus */
  format?: 'mp3' | 'opus';
  /** Include an AI-generated document summary at the start of the audio (default: true) */
  includeSummary?: boolean;
  /** When true, output only the summary—do not read the full document (default: false) */
  summaryOnly?: boolean;
}
