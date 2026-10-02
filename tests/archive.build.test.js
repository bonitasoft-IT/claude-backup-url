import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildArchive } from '../src/archive.js';
import { makeManifest, makeZipRecord } from './helpers.js';
import { sampleProject, sampleConversation } from './fixtures.js';

const now = new Date('2026-10-02T20:30:00.000Z');
const ROOT = 'claude-export-2026-09-17';
const files = (out) => Object.keys(out).filter((k) => !k.endsWith('/')).sort();

function fullReceived() {
  const project = sampleProject();
  const inProject = sampleConversation({ uuid: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Dans le projet', project_uuid: project.uuid, created_at: '2026-09-17T10:00:00Z' });
  const loose = sampleConversation({ uuid: 'bbbbbbbb-0000-0000-0000-000000000002', name: 'Sans projet' });
  return new Map([
    ['light_metadata-000.zip', makeZipRecord('light_metadata-000.zip', {
      'users.json': JSON.stringify([{ uuid: 'u-1', full_name: 'Test', email_address: 't@example.test' }]),
      'login_history.json': '{"login_events":[]}',
    })],
    ['projects-000.zip', makeZipRecord('projects-000.zip', { [`projects/${project.uuid}.json`]: JSON.stringify(project) })],
    ['conversations-000.zip', makeZipRecord('conversations-000.zip', { 'conversations.json': JSON.stringify([inProject, loose]) })],
  ]);
}

describe('buildArchive', () => {
  it('produit une archive Markdown nommée par la date du manifeste', async () => {
    const result = await buildArchive({ manifest: makeManifest(), received: fullReceived(), unknown: [], now });
    expect(result.filename).toBe(`${ROOT}.zip`);
    const out = unzipSync(result.bytes);
    expect(files(out)).toEqual([
      `${ROOT}/README.md`,
      `${ROOT}/conversations/2026-09-13-sans-projet-bbbbbbbb.md`,
      `${ROOT}/projects/migration-domaine-01a0ae9d/README.md`,
      `${ROOT}/projects/migration-domaine-01a0ae9d/conversations/2026-09-17-dans-le-projet-aaaaaaaa.md`,
    ]);
    expect(files(out).some((f) => f.endsWith('.json'))).toBe(false);
    expect(result.report).toEqual({ partial: false, missing: [], stats: { projects: 1, conversations: 2, messages: 4 }, unconverted: [] });
    const readme = strFromU8(out[`${ROOT}/README.md`]);
    expect(readme).toContain('# Export Claude du 2026-09-17 13:21 UTC');
    expect(readme).toContain('| Test | t@example.test |');
    expect(readme).not.toContain('Messages');
    expect(strFromU8(out[`${ROOT}/projects/migration-domaine-01a0ae9d/conversations/2026-09-17-dans-le-projet-aaaaaaaa.md`])).toContain('\n## Humain\n\nquestion');
  });

  it('gère une archive partielle', async () => {
    const received = fullReceived();
    received.delete('conversations-000.zip');
    const result = await buildArchive({ manifest: makeManifest(), received, unknown: [], now });
    expect(result.report.partial).toBe(true);
    expect(result.report.missing).toEqual(['conversations-000.zip']);
    const out = unzipSync(result.bytes);
    expect(strFromU8(out[`${ROOT}/README.md`])).toContain('**Archive partielle**');
    expect(files(out).some((f) => f.includes('/conversations/'))).toBe(false);
  });

  it('recopie un JSON illisible tel quel et le signale', async () => {
    const received = fullReceived();
    received.set('conversations-000.zip', makeZipRecord('conversations-000.zip', { 'conversations.json': '{ cassé' }));
    const result = await buildArchive({ manifest: makeManifest(), received, unknown: [], now });
    const out = unzipSync(result.bytes);
    expect(strFromU8(out[`${ROOT}/conversations/conversations.json`])).toBe('{ cassé');
    expect(result.report.unconverted).toEqual([{ path: 'conversations/conversations.json', reason: expect.stringMatching(/^JSON illisible/) }]);
    expect(strFromU8(out[`${ROOT}/README.md`])).toContain('## Fichiers non convertis');
  });

  it('inclut les zips inconnus sous unknown/ tels quels', async () => {
    const unknown = [makeZipRecord('extra.zip', { 'notes.txt': 'x' })];
    const result = await buildArchive({ manifest: makeManifest(), received: fullReceived(), unknown, now });
    const out = unzipSync(result.bytes);
    expect(strFromU8(out[`${ROOT}/unknown/extra/notes.txt`])).toBe('x');
    expect(strFromU8(out[`${ROOT}/README.md`])).toContain('- unknown/extra/notes.txt');
  });

  it('replie sur la date du jour si created_at est illisible', async () => {
    const manifest = makeManifest({ created_at: 'n/a' });
    const result = await buildArchive({ manifest, received: fullReceived(), unknown: [], now });
    expect(result.filename).toBe('claude-export-2026-10-02.zip');
  });

  it('refuse les chemins en double issus du placement', async () => {
    const received = fullReceived();
    received.set('projects-000.zip', makeZipRecord('projects-000.zip', { './a.json': '{}', 'a.json': '{}' }));
    await expect(buildArchive({ manifest: makeManifest(), received, unknown: [], now })).rejects.toThrow(/Chemins en double/);
  });
});
