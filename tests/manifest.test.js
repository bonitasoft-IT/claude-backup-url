import { describe, it, expect } from 'vitest';
import { parseManifest, ManifestError } from '../src/manifest.js';
import { makeManifestRaw } from './helpers.js';

const text = (raw) => JSON.stringify(raw);

describe('parseManifest', () => {
  it('accepte un manifeste valide et normalise les champs', () => {
    const { manifest, warnings } = parseManifest(text(makeManifestRaw()));
    expect(warnings).toEqual([]);
    expect(manifest.createdAt).toBe('2026-09-17T13:21:53.420700+00:00');
    expect(manifest.version).toBe('1.0');
    expect(manifest.files).toHaveLength(3);
    expect(manifest.files[1]).toEqual({
      batchIndex: 1,
      exportUrl: 'https://example.test/export/x/download/bbb',
      category: 'projects',
      part: 0,
      filename: 'projects-000.zip',
    });
  });

  it('rejette un JSON casse', () => {
    expect(() => parseManifest('{ pas du json')).toThrow(ManifestError);
    expect(() => parseManifest('{ pas du json')).toThrow(/JSON invalide/);
  });

  it('rejette une racine qui nest pas un objet', () => {
    expect(() => parseManifest('[]')).toThrow(/objet JSON/);
  });

  it('rejette data_files absent ou vide', () => {
    expect(() => parseManifest(text({ version: '1.0' }))).toThrow(/data_files manquant/);
    expect(() => parseManifest(text(makeManifestRaw({ data_files: [] })))).toThrow(/data_files est vide/);
  });

  it('rejette une entree sans export_url ou avec une URL non https', () => {
    const raw = makeManifestRaw();
    delete raw.data_files[1].export_url;
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[1\]\.export_url/);
    raw.data_files[1].export_url = 'http://example.test/x';
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[1\]\.export_url/);
  });

  it('rejette un filename sans extension .zip', () => {
    const raw = makeManifestRaw();
    raw.data_files[0].filename = 'light_metadata-000.tar';
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[0\]\.filename/);
  });

  it('rejette une category vide et un part non entier', () => {
    const raw = makeManifestRaw();
    raw.data_files[2].category = '  ';
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[2\]\.category/);
    const raw2 = makeManifestRaw();
    raw2.data_files[2].part = -1;
    expect(() => parseManifest(text(raw2))).toThrow(/data_files\[2\]\.part/);
  });

  it('rejette deux filename identiques (insensible a la casse)', () => {
    const raw = makeManifestRaw();
    raw.data_files[1].filename = 'Conversations-000.ZIP';
    expect(() => parseManifest(text(raw))).toThrow(/doublon/);
  });

  it('avertit si total_files ne correspond pas', () => {
    const { warnings } = parseManifest(text(makeManifestRaw({ total_files: 5 })));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/total_files/);
  });

  it('avertit sur une version inattendue', () => {
    const { warnings } = parseManifest(text(makeManifestRaw({ version: '2.0' })));
    expect(warnings.some((w) => /version/.test(w))).toBe(true);
  });

  it('tolere created_at et total_files absents', () => {
    const raw = makeManifestRaw();
    delete raw.created_at;
    delete raw.total_files;
    const { manifest, warnings } = parseManifest(text(raw));
    expect(manifest.createdAt).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('utilise lindex comme batchIndex si batch_index est absent', () => {
    const raw = makeManifestRaw();
    delete raw.data_files[2].batch_index;
    const { manifest } = parseManifest(text(raw));
    expect(manifest.files[2].batchIndex).toBe(2);
  });

  it('rejette une category avec des caractères de chemin', () => {
    const raw = makeManifestRaw();
    raw.data_files[1].category = '../../evil';
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[1\]\.category/);
  });

  it('accepte une category avec underscore', () => {
    expect(() => parseManifest(text(makeManifestRaw()))).not.toThrow();
  });

  it('rejette deux entrées avec le même couple category/part', () => {
    const raw = makeManifestRaw();
    raw.data_files.push({ batch_index: 3, export_url: 'https://example.test/export/x/download/ddd', category: 'conversations', part: 0, filename: 'conversations-bis.zip' });
    expect(() => parseManifest(text(raw))).toThrow(/data_files\[3\] : couple category\/part en doublon \(conversations, 0\)/);
  });
});
