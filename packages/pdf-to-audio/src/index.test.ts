import * as pdfToAudio from './index';

describe('@hazeljs/pdf-to-audio exports', () => {
  it('should export PdfToAudioModule', () => {
    expect(pdfToAudio.PdfToAudioModule).toBeDefined();
  });

  it('should export PdfToAudioService', () => {
    expect(pdfToAudio.PdfToAudioService).toBeDefined();
  });

  it('should export extractText', () => {
    expect(pdfToAudio.extractText).toBeDefined();
    expect(typeof pdfToAudio.extractText).toBe('function');
  });
});
