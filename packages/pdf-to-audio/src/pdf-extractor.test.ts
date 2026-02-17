import { extractText } from './pdf-extractor';

const mockPdf = jest.fn();

jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: (buffer: Buffer) => mockPdf(buffer),
}));

describe('extractText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text from PDF buffer', async () => {
    const buffer = Buffer.from('fake-pdf-content');
    mockPdf.mockResolvedValue({ text: 'Extracted document text' });

    const result = await extractText(buffer);

    expect(mockPdf).toHaveBeenCalledWith(buffer);
    expect(result).toBe('Extracted document text');
  });

  it('should return empty string when PDF has no text', async () => {
    mockPdf.mockResolvedValue({ text: '' });

    const result = await extractText(Buffer.from('empty-pdf'));

    expect(result).toBe('');
  });

  it('should propagate pdf-parse errors', async () => {
    mockPdf.mockRejectedValue(new Error('Invalid PDF'));

    await expect(extractText(Buffer.from('invalid'))).rejects.toThrow('Invalid PDF');
  });

  it('should handle PDF with metadata', async () => {
    mockPdf.mockResolvedValue({
      text: 'Document content',
      numpages: 5,
      info: {},
      metadata: {},
    });

    const result = await extractText(Buffer.from('pdf'));

    expect(result).toBe('Document content');
  });
});
