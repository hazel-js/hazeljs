import { IncomingMessage } from 'http';
import { Request } from '../types';
import logger from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Uploaded file information
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  destination?: string;
  filename?: (file: Partial<UploadedFile>) => string;
  limits?: {
    fileSize?: number;
    files?: number;
  };
  fileFilter?: (file: Partial<UploadedFile>) => boolean;
  storage?: 'disk' | 'memory';
}

/**
 * File upload interceptor
 */
export class FileUploadInterceptor {
  private options: Required<FileUploadOptions>;

  constructor(options: FileUploadOptions = {}) {
    this.options = {
      destination: options.destination || './uploads',
      filename: options.filename || this.defaultFilename,
      limits: options.limits || { fileSize: 10 * 1024 * 1024, files: 10 },
      fileFilter: options.fileFilter || ((): boolean => true),
      storage: options.storage || 'disk',
    };

    // Ensure destination directory exists
    if (this.options.storage === 'disk' && !fs.existsSync(this.options.destination)) {
      fs.mkdirSync(this.options.destination, { recursive: true });
    }
  }

  /**
   * Default filename generator
   */
  private defaultFilename(file: Partial<UploadedFile>): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname || '');
    return `${timestamp}-${random}${ext}`;
  }

  /**
   * Parse multipart form data
   */
  async parseMultipart(
    req: Request
  ): Promise<{ fields: Record<string, string>; files: UploadedFile[] }> {
    const contentType = req.headers?.['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      throw new Error('Content-Type must be multipart/form-data');
    }

    const boundary = this.extractBoundary(contentType);
    if (!boundary) {
      throw new Error('Missing boundary in Content-Type');
    }

    const chunks: Buffer[] = [];
    const incomingMessage = req as unknown as IncomingMessage;

    return new Promise((resolve, reject) => {
      incomingMessage.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      incomingMessage.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await this.parseBuffer(buffer, boundary);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      incomingMessage.on('error', reject);
    });
  }

  /**
   * Extract boundary from Content-Type header
   */
  private extractBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=([^;]+)/);
    return match ? match[1].trim() : null;
  }

  /**
   * Parse buffer containing multipart data
   */
  private async parseBuffer(
    buffer: Buffer,
    boundary: string
  ): Promise<{ fields: Record<string, string>; files: UploadedFile[] }> {
    const fields: Record<string, string> = {};
    const files: UploadedFile[] = [];

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = this.splitBuffer(buffer, boundaryBuffer);

    for (const part of parts) {
      if (part.length === 0) continue;

      const { headers, body } = this.parsePart(part);
      const disposition = headers['content-disposition'];

      if (!disposition) continue;

      const nameMatch = disposition.match(/name="([^"]+)"/);
      const filenameMatch = disposition.match(/filename="([^"]+)"/);

      if (filenameMatch) {
        // It's a file
        const file = await this.processFile({
          fieldname: nameMatch ? nameMatch[1] : 'file',
          originalname: filenameMatch[1],
          encoding: headers['content-transfer-encoding'] || '7bit',
          mimetype: headers['content-type'] || 'application/octet-stream',
          size: body.length,
          buffer: body,
        });

        if (file) {
          files.push(file);
        }
      } else if (nameMatch) {
        // It's a field
        fields[nameMatch[1]] = body.toString('utf-8');
      }
    }

    return { fields, files };
  }

  /**
   * Split buffer by boundary
   */
  private splitBuffer(buffer: Buffer, boundary: Buffer): Buffer[] {
    const parts: Buffer[] = [];
    let start = 0;

    while (start < buffer.length) {
      const index = buffer.indexOf(boundary, start);
      if (index === -1) break;

      if (start !== index) {
        parts.push(buffer.slice(start, index));
      }

      start = index + boundary.length;
    }

    return parts;
  }

  /**
   * Parse a single part
   */
  private parsePart(part: Buffer): { headers: Record<string, string>; body: Buffer } {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return { headers: {}, body: part };
    }

    const headerSection = part.slice(0, headerEnd).toString('utf-8');
    const body = part.slice(headerEnd + 4);

    const headers: Record<string, string> = {};
    const lines = headerSection.split('\r\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return { headers, body };
  }

  /**
   * Process uploaded file
   */
  private async processFile(file: Partial<UploadedFile>): Promise<UploadedFile | null> {
    // Check file filter
    if (!this.options.fileFilter(file)) {
      logger.warn(`File rejected by filter: ${file.originalname}`);
      return null;
    }

    // Check file size
    if (file.size && file.size > (this.options.limits.fileSize || Infinity)) {
      throw new Error(`File too large: ${file.originalname} (${file.size} bytes)`);
    }

    const filename = this.options.filename(file);
    const destination = this.options.destination;
    const filepath = path.join(destination, filename);

    const uploadedFile: UploadedFile = {
      fieldname: file.fieldname!,
      originalname: file.originalname!,
      encoding: file.encoding!,
      mimetype: file.mimetype!,
      size: file.size!,
      destination,
      filename,
      path: filepath,
    };

    if (this.options.storage === 'disk') {
      // Save to disk
      await fs.promises.writeFile(filepath, file.buffer!);
      logger.info(`File saved: ${filepath}`);
    } else {
      // Keep in memory
      uploadedFile.buffer = file.buffer;
    }

    return uploadedFile;
  }
}

/**
 * File decorator for route parameters
 */
export function UploadedFileDecorator(fieldname?: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('UploadedFile decorator must be used on a method parameter');
    }

    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata('hazel:inject', constructor, propertyKey) || [];

    injections[parameterIndex] = {
      type: 'file',
      fieldname,
    };

    Reflect.defineMetadata('hazel:inject', injections, constructor, propertyKey);
  };
}

/**
 * Files decorator for multiple files
 */
export function UploadedFilesDecorator(fieldname?: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void => {
    if (!propertyKey) {
      throw new Error('UploadedFiles decorator must be used on a method parameter');
    }

    const constructor = (target as { constructor: { new (...args: unknown[]): object } })
      .constructor;
    const injections = Reflect.getMetadata('hazel:inject', constructor, propertyKey) || [];

    injections[parameterIndex] = {
      type: 'files',
      fieldname,
    };

    Reflect.defineMetadata('hazel:inject', injections, constructor, propertyKey);
  };
}
