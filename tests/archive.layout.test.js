import { describe, it, expect } from 'vitest';
import { layoutEntries } from '../src/archive.js';
import { makeManifest, makeManifestRaw, makeZipRecord } from './helpers.js';

const paths = (placed) => placed.map((p) => p.path).sort();

describe('layoutEntries', () => {
  it('place les entrées à plat sous leur catégorie, source renseignée', () => {
    const manifest = makeManifest();
    const received = new Map([
      ['light_metadata-000.zip', makeZipRecord('light_metadata-000.zip', { 'users.json': '[]', 'login_history.json': '{}' })],
      ['conversations-000.zip', makeZipRecord('conversations-000.zip', { 'conversations.json': '[]' })],
    ]);
    const { placed, skipped } = layoutEntries({ manifest, received, unknown: [] });
    expect(paths(placed)).toEqual([
      'conversations/conversations.json',
      'light_metadata/login_history.json',
      'light_metadata/users.json',
    ]);
    expect(placed.find((p) => p.path === 'conversations/conversations.json').source).toBe('conversations-000.zip');
    expect(skipped).toEqual([]);
  });

  it('retire le préfixe égal à la catégorie', () => {
    const manifest = makeManifest();
    const received = new Map([
      ['projects-000.zip', makeZipRecord('projects-000.zip', { 'projects/p-1.json': '{}' })],
    ]);
    const { placed } = layoutEntries({ manifest, received, unknown: [] });
    expect(paths(placed)).toEqual(['projects/p-1.json']);
  });

  it('préfixe toutes les entrées en collision entre parts', () => {
    const raw = makeManifestRaw();
    raw.data_files.push({
      batch_index: 3,
      export_url: 'https://example.test/export/x/download/ddd',
      category: 'conversations',
      part: 1,
      filename: 'conversations-001.zip',
    });
    raw.total_files = 4;
    const manifest = makeManifest(raw);
    const received = new Map([
      ['conversations-000.zip', makeZipRecord('conversations-000.zip', { 'conversations.json': '[1]', 'only-in-000.json': '{}' })],
      ['conversations-001.zip', makeZipRecord('conversations-001.zip', { 'conversations.json': '[2]' })],
    ]);
    const { placed } = layoutEntries({ manifest, received, unknown: [] });
    expect(paths(placed)).toEqual([
      'conversations/only-in-000.json',
      'conversations/part000-conversations.json',
      'conversations/part001-conversations.json',
    ]);
  });

  it('préfixe en conservant le sous-dossier', () => {
    const raw = makeManifestRaw();
    raw.data_files.push({
      batch_index: 3,
      export_url: 'https://example.test/export/x/download/eee',
      category: 'projects',
      part: 1,
      filename: 'projects-001.zip',
    });
    raw.total_files = 4;
    const manifest = makeManifest(raw);
    const received = new Map([
      ['projects-000.zip', makeZipRecord('projects-000.zip', { 'projects/sub/p.json': 'a' })],
      ['projects-001.zip', makeZipRecord('projects-001.zip', { 'projects/sub/p.json': 'b' })],
    ]);
    const { placed } = layoutEntries({ manifest, received, unknown: [] });
    expect(paths(placed)).toEqual(['projects/sub/part000-p.json', 'projects/sub/part001-p.json']);
  });

  it('ignore les fichiers du manifeste non reçus', () => {
    const manifest = makeManifest();
    const { placed } = layoutEntries({ manifest, received: new Map(), unknown: [] });
    expect(placed).toEqual([]);
  });

  it('place les zips inconnus sous unknown/<nom>/', () => {
    const manifest = makeManifest();
    const unknown = [makeZipRecord('extra (1).zip', { 'a/b.json': '{}' })];
    const { placed } = layoutEntries({ manifest, received: new Map(), unknown });
    expect(paths(placed)).toEqual(['unknown/extra (1)/a/b.json']);
    expect(placed[0].source).toBe('extra (1).zip');
  });

  it('écarte les chemins avec .. et nettoie les / de tête', () => {
    const manifest = makeManifest();
    const received = new Map([
      ['projects-000.zip', makeZipRecord('projects-000.zip', { '../evil.json': '{}', '/abs.json': '{}', './ok.json': '{}' })],
    ]);
    const { placed, skipped } = layoutEntries({ manifest, received, unknown: [] });
    expect(paths(placed)).toEqual(['projects/abs.json', 'projects/ok.json']);
    expect(skipped).toEqual([{ source: 'projects-000.zip', path: '../evil.json', reason: 'chemin non sûr' }]);
  });

  it('accepte un zip reçu sans entrée', () => {
    const manifest = makeManifest();
    const received = new Map([['projects-000.zip', makeZipRecord('projects-000.zip', {})]]);
    const { placed, skipped } = layoutEntries({ manifest, received, unknown: [] });
    expect(placed).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('conserve les octets sans les modifier', () => {
    const manifest = makeManifest();
    const bytes = new Uint8Array([0, 255, 10, 13, 128]);
    const received = new Map([['projects-000.zip', makeZipRecord('projects-000.zip', { 'bin.dat': bytes })]]);
    const { placed } = layoutEntries({ manifest, received, unknown: [] });
    expect(placed[0].data).toEqual(bytes);
  });

  it('range un zip inconnu au nom dégénéré sous unknown/inconnu', () => {
    const unknown = [makeZipRecord('...zip', { 'n.txt': 'x' })];
    const { placed } = layoutEntries({ manifest: makeManifest(), received: new Map(), unknown });
    expect(paths(placed)).toEqual(['unknown/inconnu/n.txt']);
  });

  it('remplace les séparateurs dans le nom d\'un zip inconnu', () => {
    const unknown = [makeZipRecord('a/b.zip', { 'n.txt': 'x' })];
    const { placed } = layoutEntries({ manifest: makeManifest(), received: new Map(), unknown });
    expect(paths(placed)).toEqual(['unknown/a_b/n.txt']);
  });
});
