import { zip, strToU8 } from 'fflate';
import { convertExport } from './convert.js';

function sanitizeEntryPath(path) {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s !== '' && s !== '.');
  if (segments.length === 0 || segments.some((s) => s === '..')) return null;
  return segments.join('/');
}

function stripCategoryPrefix(path, category) {
  const prefix = `${category}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function partTag(part) {
  return `part${String(part).padStart(3, '0')}-`;
}

function prefixBasename(path, prefix) {
  const i = path.lastIndexOf('/');
  return i === -1 ? prefix + path : path.slice(0, i + 1) + prefix + path.slice(i + 1);
}

function unknownFolder(name) {
  const folder = name.replace(/\.zip$/i, '').replace(/[/\\]/g, '_');
  return folder === '' || /^\.+$/.test(folder) ? 'inconnu' : folder;
}

export function layoutEntries({ manifest, received, unknown }) {
  const skipped = [];
  const candidates = [];

  const ordered = [...manifest.files].sort((a, b) => a.batchIndex - b.batchIndex);
  for (const file of ordered) {
    const record = received.get(file.filename);
    if (!record) continue;
    for (const [entryPath, data] of record.entries) {
      const clean = sanitizeEntryPath(entryPath);
      if (clean === null) {
        skipped.push({ source: file.filename, path: entryPath, reason: 'chemin non sûr' });
        continue;
      }
      const rel = stripCategoryPrefix(clean, file.category);
      if (rel === '') continue;
      candidates.push({ path: `${file.category}/${rel}`, data, source: file.filename, part: file.part });
    }
  }

  const occurrences = new Map();
  for (const c of candidates) occurrences.set(c.path, (occurrences.get(c.path) ?? 0) + 1);

  const placed = candidates.map(({ path, data, source, part }) => ({
    path: occurrences.get(path) > 1 ? prefixBasename(path, partTag(part)) : path,
    data,
    source,
  }));

  for (const record of unknown) {
    const folder = unknownFolder(record.name);
    for (const [entryPath, data] of record.entries) {
      const clean = sanitizeEntryPath(entryPath);
      if (clean === null) {
        skipped.push({ source: record.name, path: entryPath, reason: 'chemin non sûr' });
        continue;
      }
      placed.push({ path: `unknown/${folder}/${clean}`, data, source: record.name });
    }
  }

  return { placed, skipped };
}

export function exportDate(createdAt, now) {
  const candidate = createdAt ? new Date(createdAt) : now;
  const date = Number.isNaN(candidate.getTime()) ? now : candidate;
  return date.toISOString().slice(0, 10);
}

function zipAsync(files, options) {
  return new Promise((resolve, reject) => {
    zip(files, options, (err, out) => (err ? reject(err) : resolve(out)));
  });
}

export async function buildArchive({ manifest, received, unknown, now = new Date() }) {
  const { placed, skipped } = layoutEntries({ manifest, received, unknown });
  const counts = new Map();
  for (const p of placed) counts.set(p.path, (counts.get(p.path) ?? 0) + 1);
  const duplicates = [...counts].filter(([, n]) => n > 1).map(([path]) => path);
  if (duplicates.length > 0) {
    throw new Error(`Chemins en double dans l'archive : ${duplicates.join(', ')}`);
  }
  const missing = manifest.files.filter((f) => !received.has(f.filename)).map((f) => f.filename);

  const { markdown, raw, stats, unconverted } = convertExport({
    placed,
    missing,
    skipped,
    createdAt: manifest.createdAt,
    generatedAt: now,
  });

  const root = `claude-export-${exportDate(manifest.createdAt, now)}`;
  const files = {};
  for (const [path, text] of markdown) files[`${root}/${path}`] = strToU8(text);
  for (const r of raw) {
    const key = `${root}/${r.path}`;
    if (key in files) throw new Error(`Chemins en double dans l'archive : ${r.path}`);
    files[key] = r.data;
  }

  const bytes = await zipAsync(files, { level: 6 });
  return { filename: `${root}.zip`, bytes, report: { partial: missing.length > 0, missing, stats, unconverted } };
}
