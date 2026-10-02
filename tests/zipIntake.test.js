import { describe, it, expect } from 'vitest';
import { strFromU8 } from 'fflate';
import { normalizeZipName, matchZip, readZipBytes, readZip, ZipReadError } from '../src/zipIntake.js';
import { makeManifest, makeZipBytes } from './helpers.js';

describe('normalizeZipName', () => {
  it('met en minuscules et retire les espaces autour', () => {
    expect(normalizeZipName('  Projects-000.ZIP ')).toBe('projects-000.zip');
  });
  it('retire le suffixe " (n)" ajouté par le navigateur', () => {
    expect(normalizeZipName('conversations-000 (1).zip')).toBe('conversations-000.zip');
    expect(normalizeZipName('conversations-000 (12).zip')).toBe('conversations-000.zip');
  });
  it('ne touche pas un nom sans suffixe', () => {
    expect(normalizeZipName('conversations-000.zip')).toBe('conversations-000.zip');
  });
});

describe('matchZip', () => {
  const manifest = makeManifest();
  it('trouve l\'entrée par nom exact', () => {
    expect(matchZip('projects-000.zip', manifest)?.category).toBe('projects');
  });
  it('est insensible à la casse et au suffixe (n)', () => {
    expect(matchZip('Conversations-000 (1).ZIP', manifest)?.filename).toBe('conversations-000.zip');
  });
  it('renvoie null pour un nom inconnu', () => {
    expect(matchZip('autre.zip', manifest)).toBeNull();
  });
});

describe('readZipBytes', () => {
  it('lit les entrées et la taille', () => {
    const bytes = makeZipBytes({ 'users.json': '[]', 'login_history.json': '{"login_events":[]}' });
    const record = readZipBytes('light_metadata-000.zip', bytes);
    expect(record.name).toBe('light_metadata-000.zip');
    expect(record.size).toBe(bytes.byteLength);
    expect([...record.entries.keys()].sort()).toEqual(['login_history.json', 'users.json']);
    expect(strFromU8(record.entries.get('users.json'))).toBe('[]');
  });

  it('ignore les entrées de répertoire', () => {
    const bytes = makeZipBytes({ 'projects/': new Uint8Array(0), 'projects/a.json': '{}' });
    const record = readZipBytes('projects-000.zip', bytes);
    expect([...record.entries.keys()]).toEqual(['projects/a.json']);
  });

  it('accepte un zip sans aucune entrée', () => {
    const record = readZipBytes('projects-000.zip', makeZipBytes({}));
    expect(record.entries.size).toBe(0);
  });

  it('lève ZipReadError sur des octets corrompus', () => {
    expect.assertions(3);
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => readZipBytes('x.zip', garbage)).toThrow(ZipReadError);
    try {
      readZipBytes('x.zip', garbage);
    } catch (e) {
      expect(e.zipName).toBe('x.zip');
      expect(e.message).toMatch(/Impossible de lire x\.zip/);
    }
  });
});

describe('readZip', () => {
  it('lit un objet File', async () => {
    const bytes = makeZipBytes({ 'conversations.json': '[]' });
    const file = new File([bytes], 'conversations-000.zip');
    const record = await readZip(file);
    expect(record.name).toBe('conversations-000.zip');
    expect(record.entries.has('conversations.json')).toBe(true);
  });
});
