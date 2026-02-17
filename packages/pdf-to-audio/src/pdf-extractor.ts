import pdf from 'pdf-parse';

/**
 * Extract raw text from a PDF buffer
 */
export async function extractText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
