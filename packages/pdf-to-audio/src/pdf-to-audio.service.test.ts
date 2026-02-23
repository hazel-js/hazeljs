import { PdfToAudioService } from './pdf-to-audio.service';

const mockExtractText = jest.fn();
jest.mock('./pdf-extractor', () => ({
  extractText: (buffer: Buffer) => mockExtractText(buffer),
}));

describe('PdfToAudioService', () => {
  let mockSpeech: jest.Mock;
  let mockComplete: jest.Mock;
  let service: PdfToAudioService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech = jest.fn().mockResolvedValue(Buffer.from('audio-chunk'));
    mockComplete = jest.fn().mockResolvedValue({
      content: 'This document covers important topics.',
    });
    const mockAiProvider = {
      speech: mockSpeech,
      complete: mockComplete,
    };
    service = new PdfToAudioService(mockAiProvider as never);
  });

  describe('convert', () => {
    it('should convert PDF to audio with document chunks', async () => {
      mockExtractText.mockResolvedValue('Short document text.');

      const result = await service.convert(Buffer.from('pdf'));

      expect(mockExtractText).toHaveBeenCalledWith(Buffer.from('pdf'));
      expect(mockSpeech).toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include summary when includeSummary is true (default)', async () => {
      mockExtractText.mockResolvedValue('Document content here.');

      await service.convert(Buffer.from('pdf'));

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Document content'),
            }),
          ]),
          model: 'gpt-4o-mini',
          maxTokens: 150,
          temperature: 0.5,
        })
      );
      expect(mockSpeech).toHaveBeenCalledWith(
        expect.stringContaining('Document summary'),
        expect.any(Object)
      );
    });

    it('should skip summary when includeSummary is false', async () => {
      mockExtractText.mockResolvedValue('Document content.');

      await service.convert(Buffer.from('pdf'), { includeSummary: false });

      expect(mockComplete).not.toHaveBeenCalled();
      expect(mockSpeech).toHaveBeenCalledWith('Document content.', expect.any(Object));
    });

    it('should output only summary when summaryOnly is true', async () => {
      mockExtractText.mockResolvedValue('Full document content here.');
      mockComplete.mockResolvedValue({ content: 'This doc covers X, Y, Z.' });

      await service.convert(Buffer.from('pdf'), { summaryOnly: true });

      expect(mockComplete).toHaveBeenCalled();
      expect(mockSpeech).toHaveBeenCalledTimes(1);
      expect(mockSpeech).toHaveBeenCalledWith(
        expect.stringMatching(/^Document summary\. This doc covers X, Y, Z\.$/),
        expect.any(Object)
      );
      expect(mockSpeech).not.toHaveBeenCalledWith(
        'Full document content here.',
        expect.any(Object)
      );
    });

    it('should use custom voice and model options', async () => {
      mockExtractText.mockResolvedValue('Text');

      await service.convert(Buffer.from('pdf'), {
        voice: 'nova',
        model: 'tts-1-hd',
        format: 'opus',
        includeSummary: false,
      });

      expect(mockSpeech).toHaveBeenCalledWith(
        'Text',
        expect.objectContaining({
          voice: 'nova',
          model: 'tts-1-hd',
          format: 'opus',
        })
      );
    });

    it('should throw when PDF has no extractable text', async () => {
      mockExtractText.mockResolvedValue('');

      await expect(service.convert(Buffer.from('pdf'))).rejects.toThrow(
        'PDF contains no extractable text'
      );
    });

    it('should throw when PDF has only whitespace', async () => {
      mockExtractText.mockResolvedValue('   \n\t  ');

      await expect(service.convert(Buffer.from('pdf'))).rejects.toThrow(
        'PDF contains no extractable text'
      );
    });

    it('should throw when AI provider has no speech method', async () => {
      const serviceNoSpeech = new PdfToAudioService({ complete: mockComplete } as never);
      mockExtractText.mockResolvedValue('Text');

      await expect(serviceNoSpeech.convert(Buffer.from('pdf'))).rejects.toThrow(
        'AI provider does not support TTS (speech)'
      );
    });

    it('should truncate long text for summary context', async () => {
      const longText = 'a'.repeat(15000);
      mockExtractText.mockResolvedValue(longText);

      await service.convert(Buffer.from('pdf'));

      const userMessage = mockComplete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user'
      );
      expect(userMessage.content).toContain('Summarize this document');
      expect(userMessage.content).toContain('...');
      expect(userMessage.content.length).toBeLessThanOrEqual(12000 + 100);
    });

    it('should handle empty summary from AI', async () => {
      mockComplete.mockResolvedValueOnce({ content: '' });
      mockExtractText.mockResolvedValue('Document text.');

      const result = await service.convert(Buffer.from('pdf'));

      expect(mockSpeech).toHaveBeenCalledWith('Document text.', expect.any(Object));
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should split long document into multiple TTS chunks', async () => {
      const longText = 'Word. '.repeat(1000);
      mockExtractText.mockResolvedValue(longText);

      await service.convert(Buffer.from('pdf'), { includeSummary: false });

      expect(mockSpeech.mock.calls.length).toBeGreaterThan(1);
    });

    it('should propagate extractText errors', async () => {
      mockExtractText.mockRejectedValue(new Error('PDF parse failed'));

      await expect(service.convert(Buffer.from('pdf'))).rejects.toThrow('PDF parse failed');
    });

    it('should propagate speech errors', async () => {
      mockExtractText.mockResolvedValue('Text');
      mockSpeech.mockRejectedValue(new Error('TTS API error'));

      await expect(service.convert(Buffer.from('pdf'), { includeSummary: false })).rejects.toThrow(
        'TTS API error'
      );
    });

    it('should call onProgress callback with completed and total', async () => {
      mockExtractText.mockResolvedValue('Chunk one. Chunk two.');
      const onProgress = jest.fn();

      await service.convert(Buffer.from('pdf'), { includeSummary: false }, onProgress);

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(lastCall[1]); // completed === total at end
      expect(lastCall[1]).toBeGreaterThan(0);
    });

    it('should throw when no audio chunks generated (summaryOnly + empty summary)', async () => {
      mockExtractText.mockResolvedValue('.');
      mockComplete.mockResolvedValue({ content: '' });

      await expect(service.convert(Buffer.from('pdf'), { summaryOnly: true })).rejects.toThrow(
        'No audio chunks were generated'
      );
    });

    it('should pass summaryOnly to generateSummary for different suffix', async () => {
      mockExtractText.mockResolvedValue('Doc.');
      mockComplete.mockResolvedValue({ content: 'Brief overview.' });

      await service.convert(Buffer.from('pdf'), { summaryOnly: true });

      expect(mockSpeech).toHaveBeenCalledWith(
        'Document summary. Brief overview.',
        expect.any(Object)
      );
      expect(mockSpeech).not.toHaveBeenCalledWith(
        expect.stringContaining('Now, the full document'),
        expect.any(Object)
      );
    });
  });
});
