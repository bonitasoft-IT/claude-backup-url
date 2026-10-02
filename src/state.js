import { matchZip } from './zipIntake.js';

export function initialState() {
  return {
    manifest: null,
    manifestBytes: null,
    warnings: [],
    downloaded: new Set(),
    received: new Map(),
    unknown: new Map(),
    errors: [],
    notices: [],
    building: false,
    result: null,
  };
}

export function applyManifest(state, { manifest, bytes, warnings }) {
  return { ...initialState(), manifest, manifestBytes: bytes, warnings };
}

export function markDownloaded(state, filename) {
  const downloaded = new Set(state.downloaded);
  downloaded.add(filename);
  return { ...state, downloaded };
}

export function receiveZip(state, zipRecord) {
  const notices = [...state.notices];
  const match = state.manifest ? matchZip(zipRecord.name, state.manifest) : null;

  if (match) {
    const received = new Map(state.received);
    if (received.has(match.filename)) notices.push(`${match.filename} remplacé par un nouveau dépôt`);
    received.set(match.filename, zipRecord);
    return { ...state, received, notices };
  }

  const unknown = new Map(state.unknown);
  const previous = unknown.get(zipRecord.name);
  if (previous) notices.push(`${zipRecord.name} remplacé par un nouveau dépôt`);
  unknown.set(zipRecord.name, { zip: zipRecord, include: previous?.include ?? false });
  return { ...state, unknown, notices };
}

export function toggleUnknown(state, name, include) {
  const current = state.unknown.get(name);
  if (!current) return state;
  const unknown = new Map(state.unknown);
  unknown.set(name, { ...current, include });
  return { ...state, unknown };
}

export function recordZipError(state, name, message) {
  return { ...state, errors: [...state.errors, { name, message }] };
}

export function clearMessages(state) {
  return { ...state, errors: [], notices: [] };
}

export function missingFiles(state) {
  if (!state.manifest) return [];
  return state.manifest.files.filter((f) => !state.received.has(f.filename)).map((f) => f.filename);
}

export function canBuild(state) {
  return state.manifest !== null && missingFiles(state).length === 0;
}

export function includedUnknown(state) {
  return [...state.unknown.values()].filter((u) => u.include).map((u) => u.zip);
}
