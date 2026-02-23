/**
 * @hazeljs/pdf-to-audio
 * Convert PDF documents to audio using TTS
 */

export { PdfToAudioModule } from './pdf-to-audio.module';
export { PdfToAudioService } from './pdf-to-audio.service';
export { PDF_TO_AUDIO_QUEUE } from './pdf-to-audio-queue.worker';
export { extractText } from './pdf-extractor';
export type { PdfToAudioOptions } from './types';
export { PDF_TO_AUDIO_OUTPUT_DIR } from './pdf-to-audio.module';
export type { PdfToAudioModuleOptions } from './pdf-to-audio.module';
