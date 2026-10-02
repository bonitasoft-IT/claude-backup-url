export class ManifestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ManifestError';
  }
}

function parseFile(raw, index) {
  const where = `data_files[${index}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ManifestError(`${where} doit être un objet`);
  }
  if (typeof raw.export_url !== 'string' || !raw.export_url.startsWith('https://')) {
    throw new ManifestError(`${where}.export_url manquant ou invalide (https:// attendu)`);
  }
  if (typeof raw.category !== 'string' || raw.category.trim() === '') {
    throw new ManifestError(`${where}.category manquant`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(raw.category)) {
    throw new ManifestError(`${where}.category invalide (lettres, chiffres, _ et - uniquement)`);
  }
  if (typeof raw.filename !== 'string' || !raw.filename.toLowerCase().endsWith('.zip')) {
    throw new ManifestError(`${where}.filename manquant ou sans extension .zip`);
  }
  if (!Number.isInteger(raw.part) || raw.part < 0) {
    throw new ManifestError(`${where}.part doit être un entier positif ou nul`);
  }
  return {
    batchIndex: Number.isInteger(raw.batch_index) ? raw.batch_index : index,
    exportUrl: raw.export_url,
    category: raw.category,
    part: raw.part,
    filename: raw.filename,
  };
}

export function parseManifest(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`JSON invalide : ${e.message}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ManifestError('Le manifeste doit être un objet JSON');
  }
  if (!Array.isArray(raw.data_files)) {
    throw new ManifestError('data_files manquant ou invalide');
  }
  if (raw.data_files.length === 0) {
    throw new ManifestError('data_files est vide');
  }

  const seen = new Set();
  const seenParts = new Set();
  const files = raw.data_files.map((f, i) => {
    const file = parseFile(f, i);
    const key = file.filename.toLowerCase();
    if (seen.has(key)) {
      throw new ManifestError(`data_files[${i}].filename en doublon : ${file.filename}`);
    }
    seen.add(key);
    const partKey = `${file.category}\u0000${file.part}`;
    if (seenParts.has(partKey)) {
      throw new ManifestError(`data_files[${i}] : couple category/part en doublon (${file.category}, ${file.part})`);
    }
    seenParts.add(partKey);
    return file;
  });

  const warnings = [];
  if (raw.total_files !== undefined && raw.total_files !== files.length) {
    warnings.push(`total_files (${raw.total_files}) ne correspond pas au nombre d'entrées (${files.length})`);
  }
  if (raw.version !== undefined && raw.version !== '1.0') {
    warnings.push(`version inattendue : ${raw.version} (1.0 attendue)`);
  }

  return {
    manifest: {
      createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
      version: typeof raw.version === 'string' ? raw.version : null,
      files,
    },
    warnings,
  };
}
