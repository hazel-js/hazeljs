import { getModuleMetadata } from '@hazeljs/core';
import { PdfToAudioModule, PDF_TO_AUDIO_OUTPUT_DIR } from './pdf-to-audio.module';
import { PdfToAudioService } from './pdf-to-audio.service';
import { PdfToAudioController } from './pdf-to-audio.controller';
import { PdfToAudioQueueWorker } from './pdf-to-audio-queue.worker';

describe('PdfToAudioModule', () => {
  it('should have correct module metadata', () => {
    const metadata = getModuleMetadata(PdfToAudioModule);

    expect(metadata).toBeDefined();
    expect(metadata?.providers).toBeDefined();
    expect(metadata?.providers?.length).toBe(4);
    expect(metadata?.providers).toContain(PdfToAudioService);
    expect(metadata?.providers).toContain(PdfToAudioQueueWorker);
    expect(
      metadata?.providers?.some(
        (p: unknown) =>
          typeof p === 'object' &&
          p !== null &&
          'provide' in p &&
          (p as { provide: unknown }).provide === PDF_TO_AUDIO_OUTPUT_DIR
      )
    ).toBe(true);
    expect(metadata?.controllers).toBeDefined();
    expect(metadata?.controllers?.length).toBe(1);
    expect(metadata?.controllers).toContain(PdfToAudioController);
  });

  it('should include custom outputDir in forRoot config', () => {
    const config = PdfToAudioModule.forRoot({
      connection: { host: 'localhost', port: 6379 },
      outputDir: './custom/audio-output',
    });
    const outputDirProvider = config.providers?.find(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        (p as { provide: unknown }).provide === PDF_TO_AUDIO_OUTPUT_DIR
    ) as { provide: string; useValue: string } | undefined;
    expect(outputDirProvider).toBeDefined();
    expect(outputDirProvider?.useValue).toContain('custom');
    expect(outputDirProvider?.useValue).toContain('audio-output');
  });

  it('should use default outputDir when not specified in forRoot', () => {
    const config = PdfToAudioModule.forRoot({
      connection: { host: 'localhost', port: 6379 },
    });
    const outputDirProvider = config.providers?.find(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        (p as { provide: unknown }).provide === PDF_TO_AUDIO_OUTPUT_DIR
    ) as { provide: string; useValue: string } | undefined;
    expect(outputDirProvider).toBeDefined();
    expect(outputDirProvider?.useValue).toContain('data');
    expect(outputDirProvider?.useValue).toContain('pdf-to-audio');
  });
});
