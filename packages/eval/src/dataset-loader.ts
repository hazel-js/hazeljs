import * as fs from 'fs';
import type { GoldenDataset } from './types';

export function loadGoldenDatasetFromJson(path: string): GoldenDataset {
  const raw = fs.readFileSync(path, 'utf8');
  const data = JSON.parse(raw) as GoldenDataset;
  if (!data.name || !data.version || !Array.isArray(data.cases)) {
    throw new Error(`Invalid golden dataset JSON at ${path}`);
  }
  return data;
}
