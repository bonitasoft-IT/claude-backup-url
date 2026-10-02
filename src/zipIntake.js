import { unzipSync } from 'fflate';

export class ZipReadError extends Error {
  constructor(zipName, cause) {
    super(`Impossible de lire ${zipName} : ${cause?.message ?? String(cause)}`);
    this.name = 'ZipReadError';
    this.zipName = zipName;
  }
}

export function normalizeZipName(name) {
  return name.trim().toLowerCase().replace(/ \(\d+\)(?=\.zip$)/, '');
}

export function matchZip(name, manifest) {
  const wanted = normalizeZipName(name);
  return manifest.files.find((f) => normalizeZipName(f.filename) === wanted) ?? null;
}

export function readZipBytes(name, bytes) {
  let raw;
  try {
    raw = unzipSync(bytes);
  } catch (e) {
    throw new ZipReadError(name, e);
  }
  const entries = new Map();
  for (const [path, data] of Object.entries(raw)) {
    if (path.endsWith('/')) continue;
    entries.set(path, data);
  }
  return { name, size: bytes.byteLength, entries };
}

export async function readZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readZipBytes(file.name, bytes);
}
