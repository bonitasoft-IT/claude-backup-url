import './styles.css';
import { parseManifest, ManifestError } from './manifest.js';
import { readZip } from './zipIntake.js';
import { buildArchive } from './archive.js';
import * as S from './state.js';
import { installWindowDropGuard } from './ui/dropzone.js';
import { render } from './ui/render.js';

const app = document.querySelector('#app');
let state = S.initialState();

function update(next) {
  state = next;
  app.replaceChildren();
  const root = document.createElement('main');
  app.appendChild(root);
  render(root, state, handlers);
}

function toBlobUrl(bytes) {
  return URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const handlers = {
  async onManifestFile(file) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { manifest, warnings } = parseManifest(new TextDecoder().decode(bytes));
      if (state.result?.url) URL.revokeObjectURL(state.result.url);
      update(S.applyManifest(state, { manifest, bytes, warnings }));
    } catch (e) {
      const message = e instanceof ManifestError ? e.message : `Lecture impossible : ${e.message}`;
      if (state.manifest) {
        update(S.recordZipError(S.clearMessages(state), file.name, message));
      } else {
        update({ ...S.initialState(), errors: [{ name: file.name, message }] });
      }
    }
  },

  onDownloadClick(filename) {
    update(S.markDownloaded(state, filename));
  },

  async onZipFiles(files) {
    const manifestAtStart = state.manifest;
    update(S.clearMessages(state));
    for (const file of files) {
      try {
        const record = await readZip(file);
        if (state.manifest !== manifestAtStart) continue;
        update(S.receiveZip(state, record));
      } catch (e) {
        if (state.manifest !== manifestAtStart) continue;
        update(S.recordZipError(state, file.name, e.message));
      }
    }
  },

  onToggleUnknown(name, include) {
    update(S.toggleUnknown(state, name, include));
  },

  async onBuild() {
    if (state.result?.url) URL.revokeObjectURL(state.result.url);
    update({ ...S.clearMessages(state), building: true, result: null });
    try {
      const { filename, bytes, report } = await buildArchive({
        manifest: state.manifest,
        received: state.received,
        unknown: S.includedUnknown(state),
      });
      const url = toBlobUrl(bytes);
      triggerDownload(url, filename);
      update({ ...state, building: false, result: { filename, size: bytes.byteLength, partial: report.partial, url } });
    } catch (e) {
      update({ ...state, building: false, errors: [...state.errors, { name: 'archive', message: `Échec de génération : ${e.message}` }] });
    }
  },
};

installWindowDropGuard();
update(state);
