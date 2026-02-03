import {
  FileUploadInterceptor,
  UploadedFileDecorator,
  UploadedFilesDecorator,
} from '../../upload/file-upload';
import { Request } from '../../types';
import * as fs from 'fs';
import 'reflect-metadata';

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
  },
}));

describe('FileUploadInterceptor', () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = './test-uploads';
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  describe('constructor', () => {
    it('should create interceptor with default options', () => {
      const interceptor = new FileUploadInterceptor();

      expect(interceptor).toBeDefined();
    });

    it('should create interceptor with custom destination', () => {
      const interceptor = new FileUploadInterceptor({
        destination: uploadDir,
      });

      expect(interceptor).toBeDefined();
      expect(fs.mkdirSync).toHaveBeenCalledWith(uploadDir, { recursive: true });
    });

    it('should create interceptor with custom filename function', () => {
      const customFilename = jest.fn(() => 'custom-name.txt');
      const interceptor = new FileUploadInterceptor({
        filename: customFilename,
      });

      expect(interceptor).toBeDefined();
    });

    it('should create interceptor with file size limits', () => {
      const interceptor = new FileUploadInterceptor({
        limits: {
          fileSize: 1024 * 1024, // 1MB
          files: 5,
        },
      });

      expect(interceptor).toBeDefined();
    });

    it('should create interceptor with file filter', () => {
      const fileFilter = jest.fn(() => true);
      const interceptor = new FileUploadInterceptor({
        fileFilter,
      });

      expect(interceptor).toBeDefined();
    });

    it('should create interceptor with memory storage', () => {
      const interceptor = new FileUploadInterceptor({
        storage: 'memory',
      });

      expect(interceptor).toBeDefined();
    });

    it('should not create directory if it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const interceptor = new FileUploadInterceptor({
        destination: uploadDir,
      });

      expect(interceptor).toBeDefined();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should not create directory for memory storage', () => {
      const interceptor = new FileUploadInterceptor({
        storage: 'memory',
        destination: uploadDir,
      });

      expect(interceptor).toBeDefined();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('parseMultipart', () => {
    it('should throw error for non-multipart content type', async () => {
      const interceptor = new FileUploadInterceptor();
      const mockReq = {
        headers: {
          'content-type': 'application/json',
        },
      } as Request;

      await expect(interceptor.parseMultipart(mockReq)).rejects.toThrow(
        'Content-Type must be multipart/form-data'
      );
    });

    it('should throw error for missing boundary', async () => {
      const interceptor = new FileUploadInterceptor();
      const mockReq = {
        headers: {
          'content-type': 'multipart/form-data',
        },
      } as Request;

      await expect(interceptor.parseMultipart(mockReq)).rejects.toThrow(
        'Missing boundary in Content-Type'
      );
    });

    it('should parse multipart data with boundary', async () => {
      const interceptor = new FileUploadInterceptor({ storage: 'memory' });
      
      const boundary = '----WebKitFormBoundary';
      const fileContent = 'test file content';
      const multipartData = [
        `------WebKitFormBoundary`,
        `Content-Disposition: form-data; name="field1"`,
        ``,
        `value1`,
        `------WebKitFormBoundary`,
        `Content-Disposition: form-data; name="file"; filename="test.txt"`,
        `Content-Type: text/plain`,
        ``,
        fileContent,
        `------WebKitFormBoundary--`,
      ].join('\r\n');

      const mockReq = {
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from(multipartData));
          }
          if (event === 'end') {
            handler();
          }
        }),
      } as unknown as Request;

      const result = await interceptor.parseMultipart(mockReq);

      expect(result.fields).toBeDefined();
      expect(result.files).toBeDefined();
    });

    it('should handle request error', async () => {
      const interceptor = new FileUploadInterceptor();
      const error = new Error('Request error');

      const mockReq = {
        headers: {
          'content-type': 'multipart/form-data; boundary=test',
        },
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(error);
          }
        }),
      } as unknown as Request;

      await expect(interceptor.parseMultipart(mockReq)).rejects.toThrow('Request error');
    });
  });

  describe('extractBoundary', () => {
    it('should extract boundary from content type', () => {
      const interceptor = new FileUploadInterceptor();
      const contentType = 'multipart/form-data; boundary=----WebKitFormBoundary';
      
      const boundary = (interceptor as any).extractBoundary(contentType);

      expect(boundary).toBe('----WebKitFormBoundary');
    });

    it('should trim boundary whitespace', () => {
      const interceptor = new FileUploadInterceptor();
      const contentType = 'multipart/form-data; boundary= ----WebKitFormBoundary ';
      
      const boundary = (interceptor as any).extractBoundary(contentType);

      expect(boundary).toBe('----WebKitFormBoundary');
    });

    it('should return null for missing boundary', () => {
      const interceptor = new FileUploadInterceptor();
      const contentType = 'multipart/form-data';
      
      const boundary = (interceptor as any).extractBoundary(contentType);

      expect(boundary).toBeNull();
    });
  });

  describe('splitBuffer', () => {
    it('should split buffer by boundary', () => {
      const interceptor = new FileUploadInterceptor();
      const boundary = Buffer.from('--boundary');
      const buffer = Buffer.from('part1--boundarypart2--boundarypart3');

      const parts = (interceptor as any).splitBuffer(buffer, boundary);

      expect(parts.length).toBeGreaterThan(0);
    });

    it('should handle empty buffer', () => {
      const interceptor = new FileUploadInterceptor();
      const boundary = Buffer.from('--boundary');
      const buffer = Buffer.from('');

      const parts = (interceptor as any).splitBuffer(buffer, boundary);

      expect(parts).toEqual([]);
    });

    it('should handle buffer without boundary', () => {
      const interceptor = new FileUploadInterceptor();
      const boundary = Buffer.from('--boundary');
      const buffer = Buffer.from('no boundary here');

      const parts = (interceptor as any).splitBuffer(buffer, boundary);

      expect(parts).toEqual([]);
    });
  });

  describe('parsePart', () => {
    it('should parse part with headers and body', () => {
      const interceptor = new FileUploadInterceptor();
      const part = Buffer.from(
        'Content-Disposition: form-data; name="field"\r\n' +
        'Content-Type: text/plain\r\n' +
        '\r\n' +
        'body content'
      );

      const result = (interceptor as any).parsePart(part);

      expect(result.headers).toBeDefined();
      expect(result.headers['content-disposition']).toContain('form-data');
      expect(result.body.toString()).toBe('body content');
    });

    it('should handle part without headers', () => {
      const interceptor = new FileUploadInterceptor();
      const part = Buffer.from('just body');

      const result = (interceptor as any).parsePart(part);

      expect(result.headers).toEqual({});
      expect(result.body).toEqual(part);
    });

    it('should parse multiple headers', () => {
      const interceptor = new FileUploadInterceptor();
      const part = Buffer.from(
        'Content-Disposition: form-data\r\n' +
        'Content-Type: application/json\r\n' +
        'X-Custom-Header: value\r\n' +
        '\r\n' +
        'body'
      );

      const result = (interceptor as any).parsePart(part);

      expect(result.headers['content-disposition']).toBe('form-data');
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['x-custom-header']).toBe('value');
    });
  });

  describe('processFile', () => {
    it('should process file with disk storage', async () => {
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const interceptor = new FileUploadInterceptor({
        storage: 'disk',
        destination: uploadDir,
      });

      const file = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('test content'),
      };

      const result = await (interceptor as any).processFile(file);

      expect(result).toBeDefined();
      expect(result.originalname).toBe('test.txt');
      expect(result.destination).toBe(uploadDir);
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should process file with memory storage', async () => {
      const interceptor = new FileUploadInterceptor({
        storage: 'memory',
      });

      const file = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('test content'),
      };

      const result = await (interceptor as any).processFile(file);

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it('should reject file by filter', async () => {
      const fileFilter = jest.fn(() => false);
      const interceptor = new FileUploadInterceptor({
        fileFilter,
      });

      const file = {
        fieldname: 'file',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        size: 100,
        buffer: Buffer.from('test'),
      };

      const result = await (interceptor as any).processFile(file);

      expect(result).toBeNull();
      expect(fileFilter).toHaveBeenCalledWith(file);
    });

    it('should throw error for file too large', async () => {
      const interceptor = new FileUploadInterceptor({
        limits: {
          fileSize: 50,
        },
      });

      const file = {
        fieldname: 'file',
        originalname: 'large.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('x'.repeat(100)),
      };

      await expect((interceptor as any).processFile(file)).rejects.toThrow(
        'File too large'
      );
    });

    it('should use custom filename function', async () => {
      const customFilename = jest.fn(() => 'custom-123.txt');
      const interceptor = new FileUploadInterceptor({
        storage: 'memory',
        filename: customFilename,
      });

      const file = {
        fieldname: 'file',
        originalname: 'original.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('test'),
      };

      const result = await (interceptor as any).processFile(file);

      expect(customFilename).toHaveBeenCalledWith(file);
      expect(result.filename).toBe('custom-123.txt');
    });
  });

  describe('defaultFilename', () => {
    it('should generate unique filename', () => {
      const interceptor = new FileUploadInterceptor();
      
      const file = {
        originalname: 'test.txt',
      };

      const filename1 = (interceptor as any).defaultFilename(file);
      const filename2 = (interceptor as any).defaultFilename(file);

      expect(filename1).toContain('.txt');
      expect(filename2).toContain('.txt');
      expect(filename1).not.toBe(filename2);
    });

    it('should preserve file extension', () => {
      const interceptor = new FileUploadInterceptor();
      
      const file = {
        originalname: 'document.pdf',
      };

      const filename = (interceptor as any).defaultFilename(file);

      expect(filename).toContain('.pdf');
    });

    it('should handle files without extension', () => {
      const interceptor = new FileUploadInterceptor();
      
      const file = {
        originalname: 'README',
      };

      const filename = (interceptor as any).defaultFilename(file);

      expect(filename).toBeDefined();
      expect(filename).not.toContain('.');
    });
  });
});

describe('UploadedFileDecorator', () => {
  it('should set metadata for file parameter', () => {
    class TestController {
      upload(@UploadedFileDecorator('avatar') file: unknown) {
        return file;
      }
    }

    const metadata = Reflect.getMetadata(
      'hazel:inject',
      TestController,
      'upload'
    );

    expect(metadata).toBeDefined();
    expect(metadata[0]).toEqual({
      type: 'file',
      fieldname: 'avatar',
    });
  });

  it('should work without fieldname', () => {
    class TestController {
      upload(@UploadedFileDecorator() file: unknown) {
        return file;
      }
    }

    const metadata = Reflect.getMetadata(
      'hazel:inject',
      TestController,
      'upload'
    );

    expect(metadata).toBeDefined();
    expect(metadata[0].type).toBe('file');
  });

  it('should throw error when used outside method parameter', () => {
    expect(() => {
      const decorator = UploadedFileDecorator();
      decorator({}, undefined as any, 0);
    }).toThrow('UploadedFile decorator must be used on a method parameter');
  });
});

describe('UploadedFilesDecorator', () => {
  it('should set metadata for files parameter', () => {
    class TestController {
      uploadMultiple(@UploadedFilesDecorator('photos') files: unknown) {
        return files;
      }
    }

    const metadata = Reflect.getMetadata(
      'hazel:inject',
      TestController,
      'uploadMultiple'
    );

    expect(metadata).toBeDefined();
    expect(metadata[0]).toEqual({
      type: 'files',
      fieldname: 'photos',
    });
  });

  it('should work without fieldname', () => {
    class TestController {
      uploadMultiple(@UploadedFilesDecorator() files: unknown) {
        return files;
      }
    }

    const metadata = Reflect.getMetadata(
      'hazel:inject',
      TestController,
      'uploadMultiple'
    );

    expect(metadata).toBeDefined();
    expect(metadata[0].type).toBe('files');
  });

  it('should throw error when used outside method parameter', () => {
    expect(() => {
      const decorator = UploadedFilesDecorator();
      decorator({}, undefined as any, 0);
    }).toThrow('UploadedFiles decorator must be used on a method parameter');
  });

  it('should handle multiple parameters', () => {
    class TestController {
      upload(
        @UploadedFileDecorator('avatar') avatar: unknown,
        @UploadedFilesDecorator('photos') photos: unknown
      ) {
        return { avatar, photos };
      }
    }

    const metadata = Reflect.getMetadata(
      'hazel:inject',
      TestController,
      'upload'
    );

    expect(metadata).toBeDefined();
    expect(metadata[0].type).toBe('file');
    expect(metadata[1].type).toBe('files');
  });
});
