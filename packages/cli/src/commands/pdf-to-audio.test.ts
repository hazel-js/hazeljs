import fs from 'fs';
import { Command } from 'commander';
import FormData from 'form-data';
import { pdfToAudioCommand } from './pdf-to-audio';

jest.mock('fs');
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn(() => ({})),
  }));
});

describe('pdf-to-audio', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const MockFormData = FormData as unknown as jest.Mock;

  let exitSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeAll(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
    mockFs.createReadStream.mockReturnValue({} as any);
  });

  it('convert: exits when file is not a PDF', async () => {
    const program = new Command();
    pdfToAudioCommand(program);
    await program.parseAsync(['pdf-to-audio', 'convert', 'not-a-pdf.txt'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('convert: exits when file does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);
    const program = new Command();
    pdfToAudioCommand(program);
    await program.parseAsync(['pdf-to-audio', 'convert', 'file.pdf'], { from: 'user' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('convert: submits job and prints job id (no wait)', async () => {
    mockFs.existsSync.mockReturnValue(true);
    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: 'job-123' }),
    });

    const program = new Command();
    pdfToAudioCommand(program);
    await program.parseAsync(['pdf-to-audio', 'convert', 'file.pdf', '--api-url', 'http://x'], { from: 'user' });

    expect(MockFormData).toHaveBeenCalled();
    expect((global as any).fetch).toHaveBeenCalled();
    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('Job submitted: job-123');
  });

  it('status: prints download hint when completed without output', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: 'job-1', status: 'completed', progress: 100 }),
    });
    const program = new Command();
    pdfToAudioCommand(program);
    await program.parseAsync(['pdf-to-audio', 'status', 'job-1', '--api-url', 'http://x'], { from: 'user' });
    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('Download: GET');
  });

  it('status: downloads audio when completed with output', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-2', status: 'completed', progress: 100 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(3),
        text: async () => '',
      });

    const program = new Command();
    pdfToAudioCommand(program);
    await program.parseAsync(
      ['pdf-to-audio', 'status', 'job-2', '--api-url', 'http://x', '--output', 'out.mp3'],
      { from: 'user' }
    );

    expect(mockFs.writeFileSync).toHaveBeenCalledWith('out.mp3', expect.any(Buffer));
  });
});

