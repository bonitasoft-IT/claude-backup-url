import { zipSync, strToU8 } from 'fflate';
import { parseManifest } from '../src/manifest.js';
import { readZipBytes } from '../src/zipIntake.js';

export function makeManifestRaw(overrides = {}) {
  return {
    instructions: 'Download each file using the export_url. Note: Each export URL can only be used once.',
    created_at: '2026-09-17T13:21:53.420700+00:00',
    total_files: 3,
    version: '1.0',
    data_files: [
      { batch_index: 0, export_url: 'https://example.test/export/x/download/aaa', category: 'light_metadata', part: 0, filename: 'light_metadata-000.zip' },
      { batch_index: 1, export_url: 'https://example.test/export/x/download/bbb', category: 'projects', part: 0, filename: 'projects-000.zip' },
      { batch_index: 2, export_url: 'https://example.test/export/x/download/ccc', category: 'conversations', part: 0, filename: 'conversations-000.zip' },
    ],
    ...overrides,
  };
}

export function makeManifest(overrides = {}) {
  return parseManifest(JSON.stringify(makeManifestRaw(overrides))).manifest;
}

export function makeZipBytes(entries) {
  const data = {};
  for (const [path, value] of Object.entries(entries)) {
    data[path] = typeof value === 'string' ? strToU8(value) : value;
  }
  return zipSync(data);
}

export function makeZipRecord(name, entries) {
  return readZipBytes(name, makeZipBytes(entries));
}
