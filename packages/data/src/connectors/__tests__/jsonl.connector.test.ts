import { JsonlSource, JsonlSink } from '../jsonl.connector';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(__dirname, '__test_data__');
const TEST_FILE = join(TEST_DIR, 'test.jsonl');
const OUTPUT_FILE = join(TEST_DIR, 'output.jsonl');

describe('JsonlSource', () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up test files
    [TEST_FILE, OUTPUT_FILE].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe('constructor', () => {
    it('should create source with default name', () => {
      const source = new JsonlSource({ filePath: TEST_FILE });
      expect(source.name).toBe(`jsonl:${TEST_FILE}`);
    });

    it('should create source with custom name', () => {
      const source = new JsonlSource({ filePath: TEST_FILE, name: 'custom-source' });
      expect(source.name).toBe('custom-source');
    });
  });

  describe('open', () => {
    it('should throw error if file does not exist', async () => {
      const source = new JsonlSource({ filePath: TEST_FILE });
      await expect(source.open()).rejects.toThrow('JSONL file not found');
    });

    it('should open successfully if file exists', async () => {
      writeFileSync(TEST_FILE, '{"id": 1}\n');
      const source = new JsonlSource({ filePath: TEST_FILE });
      await expect(source.open()).resolves.toBeUndefined();
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      writeFileSync(TEST_FILE, '{"id": 1}\n');
      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();
      await expect(source.close()).resolves.toBeUndefined();
    });
  });

  describe('read', () => {
    it('should read records from JSONL file', async () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];
      writeFileSync(TEST_FILE, data.map((d) => JSON.stringify(d)).join('\n'));

      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();

      const records: Record<string, unknown>[] = [];
      for await (const record of source.read()) {
        records.push(record);
      }

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({ id: 1, name: 'Alice' });
      expect(records[1]).toEqual({ id: 2, name: 'Bob' });
      expect(records[2]).toEqual({ id: 3, name: 'Charlie' });

      await source.close();
    });

    it('should skip empty lines', async () => {
      const content = '{"id": 1}\n\n{"id": 2}\n  \n{"id": 3}\n';
      writeFileSync(TEST_FILE, content);

      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();

      const records: Record<string, unknown>[] = [];
      for await (const record of source.read()) {
        records.push(record);
      }

      expect(records).toHaveLength(3);
      await source.close();
    });

    it('should throw error for invalid JSON', async () => {
      writeFileSync(TEST_FILE, '{"id": 1}\n{invalid json}\n{"id": 3}\n');

      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();

      await expect(async () => {
        for await (const record of source.read()) {
          // Process records
          void record;
        }
      }).rejects.toThrow('Failed to parse JSONL line');

      await source.close();
    });

    it('should handle empty file', async () => {
      writeFileSync(TEST_FILE, '');

      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();

      const records: Record<string, unknown>[] = [];
      for await (const record of source.read()) {
        records.push(record);
      }

      expect(records).toHaveLength(0);
      await source.close();
    });
  });

  describe('readAll', () => {
    it('should read all records at once', async () => {
      const data = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
      ];
      writeFileSync(TEST_FILE, data.map((d) => JSON.stringify(d)).join('\n'));

      const source = new JsonlSource({ filePath: TEST_FILE });
      await source.open();

      const records = await source.readAll();

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ id: 1, value: 'a' });
      expect(records[1]).toEqual({ id: 2, value: 'b' });

      await source.close();
    });
  });
});

describe('JsonlSink', () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    [TEST_FILE, OUTPUT_FILE].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe('constructor', () => {
    it('should create sink with default name', () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      expect(sink.name).toBe(`jsonl:${OUTPUT_FILE}`);
    });

    it('should create sink with custom name', () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE, name: 'custom-sink' });
      expect(sink.name).toBe('custom-sink');
    });
  });

  describe('open', () => {
    it('should create write stream', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await expect(sink.open()).resolves.toBeUndefined();
      await sink.close();
    });
  });

  describe('write', () => {
    it('should write single record', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();

      await sink.write({ id: 1, name: 'Test' });
      await sink.close();

      const source = new JsonlSource({ filePath: OUTPUT_FILE });
      await source.open();
      const records = await source.readAll();
      await source.close();

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: 1, name: 'Test' });
    });

    it('should throw error if not opened', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await expect(sink.write({ id: 1 })).rejects.toThrow('call open() before write()');
    });

    it('should write multiple records sequentially', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();

      await sink.write({ id: 1 });
      await sink.write({ id: 2 });
      await sink.write({ id: 3 });
      await sink.close();

      const source = new JsonlSource({ filePath: OUTPUT_FILE });
      await source.open();
      const records = await source.readAll();
      await source.close();

      expect(records).toHaveLength(3);
    });
  });

  describe('writeBatch', () => {
    it('should write batch of records', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();

      const records = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];
      await sink.writeBatch(records);
      await sink.close();

      const source = new JsonlSource({ filePath: OUTPUT_FILE });
      await source.open();
      const readRecords = await source.readAll();
      await source.close();

      expect(readRecords).toHaveLength(3);
      expect(readRecords).toEqual(records);
    });

    it('should throw error if not opened', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await expect(sink.writeBatch([{ id: 1 }])).rejects.toThrow('call open() before writeBatch()');
    });

    it('should handle empty batch', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();
      await sink.writeBatch([]);
      await sink.close();

      const source = new JsonlSource({ filePath: OUTPUT_FILE });
      await source.open();
      const records = await source.readAll();
      await source.close();

      expect(records).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('should close stream successfully', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();
      await expect(sink.close()).resolves.toBeUndefined();
    });

    it('should handle close without open', async () => {
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await expect(sink.close()).resolves.toBeUndefined();
    });
  });

  describe('integration', () => {
    it('should write and read back data correctly', async () => {
      const originalData = [
        { id: 1, name: 'Alice', age: 30, active: true },
        { id: 2, name: 'Bob', age: 25, active: false },
        { id: 3, name: 'Charlie', age: 35, active: true },
      ];

      // Write data
      const sink = new JsonlSink({ filePath: OUTPUT_FILE });
      await sink.open();
      await sink.writeBatch(originalData);
      await sink.close();

      // Read data back
      const source = new JsonlSource({ filePath: OUTPUT_FILE });
      await source.open();
      const readData = await source.readAll();
      await source.close();

      expect(readData).toEqual(originalData);
    });
  });
});
