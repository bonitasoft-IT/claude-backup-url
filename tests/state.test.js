import { describe, it, expect } from 'vitest';
import {
  initialState, applyManifest, markDownloaded, receiveZip, toggleUnknown,
  recordZipError, clearMessages, missingFiles, canBuild, includedUnknown,
} from '../src/state.js';
import { makeManifest, makeZipRecord } from './helpers.js';

function loaded() {
  return applyManifest(initialState(), { manifest: makeManifest(), bytes: new Uint8Array([1]), warnings: ['w1'] });
}

describe('state', () => {
  it('démarre vide et ne peut pas générer', () => {
    const s = initialState();
    expect(s.manifest).toBeNull();
    expect(canBuild(s)).toBe(false);
    expect(missingFiles(s)).toEqual([]);
  });

  it('applyManifest repart d\'un état neuf avec le manifeste et les avertissements', () => {
    const dirty = recordZipError(initialState(), 'x.zip', 'boom');
    const s = applyManifest(dirty, { manifest: makeManifest(), bytes: new Uint8Array([1]), warnings: ['w1'] });
    expect(s.errors).toEqual([]);
    expect(s.warnings).toEqual(['w1']);
    expect(s.manifestBytes).toEqual(new Uint8Array([1]));
    expect(missingFiles(s)).toEqual(['light_metadata-000.zip', 'projects-000.zip', 'conversations-000.zip']);
  });

  it('markDownloaded ajoute au Set sans muter l\'ancien état', () => {
    const s0 = loaded();
    const s1 = markDownloaded(s0, 'projects-000.zip');
    expect(s1.downloaded.has('projects-000.zip')).toBe(true);
    expect(s0.downloaded.has('projects-000.zip')).toBe(false);
  });

  it('receiveZip range un zip connu dans received et débloque canBuild quand tout est là', () => {
    let s = loaded();
    s = receiveZip(s, makeZipRecord('light_metadata-000.zip', { 'users.json': '[]' }));
    s = receiveZip(s, makeZipRecord('Projects-000 (1).zip', {}));
    expect(canBuild(s)).toBe(false);
    expect(missingFiles(s)).toEqual(['conversations-000.zip']);
    s = receiveZip(s, makeZipRecord('conversations-000.zip', { 'conversations.json': '[]' }));
    expect(canBuild(s)).toBe(true);
    expect([...s.received.keys()].sort()).toEqual(['conversations-000.zip', 'light_metadata-000.zip', 'projects-000.zip']);
  });

  it('receiveZip remplace un zip déjà reçu et ajoute un avertissement', () => {
    let s = loaded();
    s = receiveZip(s, makeZipRecord('projects-000.zip', { 'a.json': '1' }));
    s = receiveZip(s, makeZipRecord('projects-000.zip', { 'b.json': '2' }));
    expect([...s.received.get('projects-000.zip').entries.keys()]).toEqual(['b.json']);
    expect(s.notices).toEqual(['projects-000.zip remplacé par un nouveau dépôt']);
  });

  it('receiveZip range un zip inconnu dans unknown, exclu par défaut', () => {
    const s = receiveZip(loaded(), makeZipRecord('extra.zip', { 'x': '1' }));
    expect(s.unknown.get('extra.zip').include).toBe(false);
    expect(includedUnknown(s)).toEqual([]);
  });

  it('toggleUnknown inclut un zip inconnu et survit à un redépôt', () => {
    let s = receiveZip(loaded(), makeZipRecord('extra.zip', { 'x': '1' }));
    s = toggleUnknown(s, 'extra.zip', true);
    expect(includedUnknown(s).map((z) => z.name)).toEqual(['extra.zip']);
    s = receiveZip(s, makeZipRecord('extra.zip', { 'y': '2' }));
    expect(s.unknown.get('extra.zip').include).toBe(true);
    expect(s.notices).toContain('extra.zip remplacé par un nouveau dépôt');
  });

  it('toggleUnknown ignore un nom absent', () => {
    const s = loaded();
    expect(toggleUnknown(s, 'absent.zip', true)).toBe(s);
  });

  it('recordZipError et clearMessages', () => {
    let s = recordZipError(loaded(), 'bad.zip', 'Impossible de lire bad.zip');
    expect(s.errors).toEqual([{ name: 'bad.zip', message: 'Impossible de lire bad.zip' }]);
    s = clearMessages(s);
    expect(s.errors).toEqual([]);
    expect(s.notices).toEqual([]);
  });
});
