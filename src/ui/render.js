import { missingFiles, canBuild } from '../state.js';
import { attachDropzone } from './dropzone.js';

// Rendu par construction DOM uniquement : aucun innerHTML, chaque valeur dynamique
// devient un nœud texte. Les href n'acceptent que https: (export_url) et blob: (archive).
const SAFE_HREF = /^(https:|blob:)/i;
const BOOLEAN_ATTRS = new Set(['checked', 'disabled', 'multiple']);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) continue;
    if (key === 'href') {
      if (SAFE_HREF.test(String(value))) el.setAttribute('href', String(value));
      continue;
    }
    if (BOOLEAN_ATTRS.has(key)) {
      el[key] = Boolean(value);
      continue;
    }
    el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return el;
}

function formatBytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 ** 2).toFixed(1)} Mo`;
}

function renderMessages(state) {
  const items = [
    ...state.warnings.map((m) => ({ kind: 'warning', text: m })),
    ...state.notices.map((m) => ({ kind: 'notice', text: m })),
    ...state.errors.map((e) => ({ kind: 'error', text: `${e.name} : ${e.message}` })),
  ];
  if (items.length === 0) return null;
  return h('ul', { class: 'messages' }, items.map((i) => h('li', { class: i.kind }, i.text)));
}

function renderManifestStep(state) {
  const loaded = state.manifest
    ? h('p', { class: 'ok' },
        `Manifeste chargé : ${state.manifest.files.length} fichier(s) attendu(s)`,
        state.manifest.createdAt ? `, export du ${state.manifest.createdAt}` : '',
        '.')
    : null;
  return h('section', { class: 'step' },
    h('h2', {}, '1. Manifeste'),
    h('p', {}, 'Déposez le fichier ', h('code', {}, 'member-manifest-*.json'), ' fourni par Claude.'),
    h('div', { class: 'dropzone', id: 'manifest-zone' },
      h('p', {}, 'Glissez le manifeste ici ou cliquez pour le choisir'),
      h('input', { type: 'file', id: 'manifest-input', accept: '.json,application/json' })),
    loaded);
}

function renderDownloadStep(state) {
  const rows = state.manifest.files.map((f) => {
    const downloaded = state.downloaded.has(f.filename);
    const record = state.received.get(f.filename);
    const link = (cls, label) => h('a', {
      href: f.exportUrl, target: '_blank', rel: 'noopener', class: cls, 'data-action': 'download', 'data-filename': f.filename,
    }, label);
    const action = downloaded
      ? [h('span', { class: 'muted' }, 'Téléchargé, URL à usage unique.'), ' ', link('retry', 'réessayer')]
      : [link('btn', 'Télécharger')];
    const status = record
      ? h('span', { class: 'ok' }, `✓ reçu (${formatBytes(record.size)}, ${record.entries.size} entrée(s))`)
      : h('span', { class: 'muted' }, 'en attente');
    return h('tr', {},
      h('td', {}, f.category),
      h('td', {}, h('code', {}, f.filename)),
      h('td', {}, String(f.part)),
      h('td', {}, action),
      h('td', {}, status));
  });
  return h('section', { class: 'step' },
    h('h2', {}, '2. Téléchargement'),
    h('p', {},
      "Chaque lien s'ouvre dans un nouvel onglet et lance le téléchargement via votre session claude.ai. ",
      h('strong', {}, "Chaque URL ne fonctionne qu'une seule fois"),
      ' : ne cliquez qu\'une fois par fichier.'),
    h('table', {},
      h('thead', {}, h('tr', {}, ['Catégorie', 'Fichier', 'Part', 'Action', 'État'].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows)));
}

function renderDropStep(state) {
  const unknown = [...state.unknown.entries()];
  const unknownList = unknown.length === 0 ? [] : [
    h('h3', {}, 'Fichiers inconnus'),
    h('p', {}, 'Ces zips ne figurent pas dans le manifeste. Cochez-les pour les inclure sous ', h('code', {}, 'unknown/'), '.'),
    h('ul', { class: 'unknown' }, unknown.map(([name, u]) => h('li', {},
      h('label', {},
        h('input', { type: 'checkbox', 'data-action': 'toggle-unknown', 'data-name': name, checked: u.include }),
        ' ',
        h('code', {}, name),
        ` (${formatBytes(u.zip.size)}, ${u.zip.entries.size} entrée(s))`)))),
  ];
  return h('section', { class: 'step' },
    h('h2', {}, '3. Dépôt des zips'),
    h('p', {}, 'Déposez ici les zips téléchargés (plusieurs à la fois possible). Rien ne quitte votre navigateur.'),
    h('div', { class: 'dropzone', id: 'zip-zone' },
      h('p', {}, 'Glissez les zips ici ou cliquez pour les choisir'),
      h('input', { type: 'file', id: 'zip-input', accept: '.zip,application/zip', multiple: true })),
    h('p', {}, `${state.received.size} / ${state.manifest.files.length} fichier(s) du manifeste reçu(s).`),
    unknownList);
}

function renderBuildStep(state) {
  const missing = missingFiles(state);
  const ready = canBuild(state);
  const hasSomething = state.received.size > 0 || [...state.unknown.values()].some((u) => u.include);

  let body;
  if (state.building) {
    body = [h('p', {}, 'Génération en cours…')];
  } else if (ready) {
    body = [h('button', { class: 'btn primary', 'data-action': 'build' }, "Générer l'archive")];
  } else {
    const codes = missing.flatMap((m, i) => (i === 0 ? [h('code', {}, m)] : [', ', h('code', {}, m)]));
    body = [
      h('p', { class: 'warning' }, `Il manque ${missing.length} fichier(s) : `, codes, '.'),
      h('button', { class: 'btn primary', disabled: true }, "Générer l'archive"),
      hasSomething ? h('button', { class: 'btn', 'data-action': 'build' }, 'Générer quand même (partiel)') : null,
    ];
  }

  const result = state.result
    ? h('p', { class: 'ok' },
        `Archive ${state.result.partial ? 'partielle ' : ''}générée : `,
        h('a', { href: state.result.url, download: state.result.filename }, state.result.filename),
        ` (${formatBytes(state.result.size)}).`)
    : null;

  return h('section', { class: 'step' }, h('h2', {}, '4. Archive'), body, result);
}

function bind(root, state, handlers) {
  const manifestZone = root.querySelector('#manifest-zone');
  const manifestInput = root.querySelector('#manifest-input');
  attachDropzone(manifestZone, manifestInput, (files) => {
    if (state.manifest && files.some((f) => f.name.toLowerCase().endsWith('.zip'))) {
      handlers.onZipFiles(files);
    } else if (files[0]) {
      handlers.onManifestFile(files[0]);
    }
  });

  const zipZone = root.querySelector('#zip-zone');
  const zipInput = root.querySelector('#zip-input');
  if (zipZone && zipInput) attachDropzone(zipZone, zipInput, handlers.onZipFiles);

  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const { action } = target.dataset;
    if (action === 'download') handlers.onDownloadClick(target.dataset.filename);
    if (action === 'build') handlers.onBuild();
  });

  root.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action="toggle-unknown"]');
    if (target) handlers.onToggleUnknown(target.dataset.name, target.checked);
  });
}

export function render(root, state, handlers) {
  const header = h('header', {},
    h('h1', {}, 'Claude Export Merger'),
    h('p', {}, "Regroupe les zips d'export Claude en une seule archive. Tout se passe dans votre navigateur, aucune donnée n'est envoyée."));
  root.replaceChildren(...[
    header,
    renderMessages(state),
    renderManifestStep(state),
    state.manifest ? renderDownloadStep(state) : null,
    state.manifest ? renderDropStep(state) : null,
    state.manifest ? renderBuildStep(state) : null,
  ].filter(Boolean));
  bind(root, state, handlers);
}
