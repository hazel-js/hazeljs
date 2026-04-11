import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadGoldenDatasetFromJson } from './dataset-loader';

describe('dataset-loader', () => {
  let tmpFile: string;

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  it('loads valid JSON', () => {
    tmpFile = path.join(os.tmpdir(), `eval-ds-${Date.now()}.json`);
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        name: 't',
        version: '1',
        cases: [{ id: '1', input: 'hi' }],
      }),
      'utf8'
    );
    const ds = loadGoldenDatasetFromJson(tmpFile);
    expect(ds.name).toBe('t');
    expect(ds.cases).toHaveLength(1);
  });

  it('throws on invalid shape', () => {
    tmpFile = path.join(os.tmpdir(), `eval-bad-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ name: 'x' }), 'utf8');
    expect(() => loadGoldenDatasetFromJson(tmpFile)).toThrow(/Invalid golden dataset/);
  });
});
