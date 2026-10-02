import { describe, it, expect } from 'vitest';
import { convertExport } from '../src/convert.js';
import { entry, sampleProject, sampleConversation } from './fixtures.js';

const users = [{ uuid: 'u-1', full_name: 'Test User', email_address: 't@example.test', verified_phone_number: null }];
const logins = { login_events: [{ timestamp: '2026-09-13T09:53:31Z', ip_address: '10.0.0.1', user_agent: { browser_family: 'Chrome', browser_version: '1', os_family: 'Linux' }, method: 'sso' }] };
const now = new Date('2026-10-02T20:30:00.000Z');
const paths = (m) => [...m.keys()].sort();

function fullPlaced() {
  const project = sampleProject();
  const inProject = sampleConversation({ uuid: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Dans le projet', project_uuid: project.uuid, created_at: '2026-09-17T10:00:00Z' });
  const loose = sampleConversation({ uuid: 'bbbbbbbb-0000-0000-0000-000000000002', name: 'Sans projet', project_uuid: null });
  const orphan = sampleConversation({ uuid: 'cccccccc-0000-0000-0000-000000000003', name: 'Projet inconnu', project_uuid: 'p-404', created_at: '2026-09-14T08:00:00Z' });
  return [
    entry('light_metadata/users.json', users),
    entry('light_metadata/login_history.json', logins),
    entry(`projects/${project.uuid}.json`, project),
    entry('conversations/conversations.json', [inProject, loose, orphan]),
  ];
}

describe('convertExport', () => {
  it('range projets, conversations et compte aux bons chemins', () => {
    const { markdown, raw, stats, unconverted } = convertExport({ placed: fullPlaced(), createdAt: '2026-09-17T13:21:53Z', generatedAt: now });
    expect(paths(markdown)).toEqual([
      'README.md',
      'conversations/2026-09-13-sans-projet-bbbbbbbb.md',
      'conversations/2026-09-14-projet-inconnu-cccccccc.md',
      'projects/migration-domaine-01a0ae9d/README.md',
      'projects/migration-domaine-01a0ae9d/conversations/2026-09-17-dans-le-projet-aaaaaaaa.md',
    ]);
    expect(raw).toEqual([]);
    expect(unconverted).toEqual([]);
    expect(stats).toEqual({ projects: 1, conversations: 3, messages: 6 });
    expect(markdown.get('projects/migration-domaine-01a0ae9d/conversations/2026-09-17-dans-le-projet-aaaaaaaa.md')).toContain('Conversation du 17 septembre 2026 à 10:00 UTC · Projet : [Migration domaine](../README.md)');
    expect(markdown.get('conversations/2026-09-14-projet-inconnu-cccccccc.md')).toContain('Conversation du 14 septembre 2026 à 08:00 UTC · Projet inconnu');
    expect(markdown.get('projects/migration-domaine-01a0ae9d/README.md')).toContain('- [Dans le projet](conversations/2026-09-17-dans-le-projet-aaaaaaaa.md)');
    const readme = markdown.get('README.md');
    expect(readme).toContain('- [Migration domaine](projects/migration-domaine-01a0ae9d/README.md) — 1 conversation(s)');
    expect(readme).toContain('- [Sans projet](conversations/2026-09-13-sans-projet-bbbbbbbb.md)');
    expect(markdown.has('compte.md')).toBe(false);
    expect(readme).toContain('## Compte\n\n| Nom | E-mail |\n| --- | --- |\n| Test User | t@example.test |');
    expect(readme).not.toContain('10.0.0.1');
    expect(readme).not.toContain('u-1');
    expect(readme).not.toContain('Messages');
  });

  it('dédoublonne les parts par uuid en gardant le plus récent', () => {
    const old = sampleConversation({ name: 'Ancien titre', updated_at: '2026-09-13T11:09:01Z' });
    const recent = sampleConversation({ name: 'Nouveau titre', updated_at: '2026-09-14T00:00:00Z' });
    const p1 = sampleProject();
    const p2 = sampleProject({ name: 'Projet renommé', updated_at: '2026-09-18T00:00:00Z' });
    const placed = [
      entry('conversations/part000-conversations.json', [old]),
      entry('conversations/part001-conversations.json', [recent]),
      entry(`projects/part000-${p1.uuid}.json`, p1),
      entry(`projects/part001-${p1.uuid}.json`, p2),
    ];
    const { markdown, stats } = convertExport({ placed, generatedAt: now });
    expect(stats).toEqual({ projects: 1, conversations: 1, messages: 2 });
    expect(paths(markdown)).toContain('conversations/2026-09-13-nouveau-titre-155a6a46.md');
    expect(paths(markdown)).toContain('projects/projet-renomme-01a0ae9d/README.md');
  });

  it('neutralise un uuid hostile dans le chemin', () => {
    const conv = sampleConversation({ uuid: '/../../x', name: 'Piège', project_uuid: null, created_at: '2026-09-14T08:00:00Z' });
    const { markdown } = convertExport({ placed: [entry('conversations/conversations.json', [conv])], generatedAt: now });
    const keys = [...markdown.keys()];
    expect(keys).toContain('conversations/2026-09-14-piege-inconnu.md');
    expect(keys.some((k) => k.includes('..'))).toBe(false);
  });

  it('recopie un JSON illisible tel quel et le liste', () => {
    const placed = [entry('conversations/conversations.json', '{ cassé'), entry('projects/p.json', '[1, 2'), entry('light_metadata/users.json', { pas: 'un tableau' })];
    const { markdown, raw, unconverted } = convertExport({ placed, generatedAt: now });
    expect(raw.map((r) => r.path).sort()).toEqual(['conversations/conversations.json', 'light_metadata/users.json', 'projects/p.json']);
    expect(unconverted.map((u) => u.path).sort()).toEqual(['conversations/conversations.json', 'light_metadata/users.json', 'projects/p.json']);
    expect(unconverted.find((u) => u.path === 'conversations/conversations.json').reason).toMatch(/^JSON illisible/);
    expect(unconverted.find((u) => u.path === 'light_metadata/users.json').reason).toBe('structure inattendue');
    expect(markdown.get('README.md')).toContain('## Fichiers non convertis');
    expect(markdown.has('compte.md')).toBe(false);
  });

  it('recopie unknown/ et les fichiers non JSON, et les liste tous', () => {
    const placed = [entry('unknown/autre/note.txt', 'hello'), entry('conversations/readme.txt', 'x')];
    const { markdown, raw } = convertExport({ placed, generatedAt: now });
    expect(raw.map((r) => r.path).sort()).toEqual(['conversations/readme.txt', 'unknown/autre/note.txt']);
    const readme = markdown.get('README.md');
    expect(readme).toContain('## Fichiers recopiés tels quels\n\n');
    expect(readme).toContain('- unknown/autre/note.txt');
    expect(readme).toContain('- conversations/readme.txt');
  });

  it('ignore login_history.json : ni compte, ni copie brute, ni mention', () => {
    const { markdown, raw, unconverted } = convertExport({ placed: [entry('light_metadata/login_history.json', logins)], generatedAt: now });
    expect(markdown.has('compte.md')).toBe(false);
    expect(raw).toEqual([]);
    expect(unconverted).toEqual([]);
    const readme = markdown.get('README.md');
    expect(readme).not.toContain('compte.md');
    expect(readme).not.toContain('login_history');
    expect(readme).toContain('_Aucune information de compte dans l’export._');
  });

  it('distingue deux conversations de même titre et même jour', () => {
    const a = sampleConversation({ uuid: 'aaaaaaaa-1111-0000-0000-000000000000', name: 'Même titre' });
    const b = sampleConversation({ uuid: 'bbbbbbbb-2222-0000-0000-000000000000', name: 'Même titre' });
    const { markdown } = convertExport({ placed: [entry('conversations/conversations.json', [a, b])], generatedAt: now });
    expect(paths(markdown)).toEqual(expect.arrayContaining([
      'conversations/2026-09-13-meme-titre-aaaaaaaa.md',
      'conversations/2026-09-13-meme-titre-bbbbbbbb.md',
    ]));
  });

  it('suffixe -2 en cas de collision résiduelle de chemin', () => {
    const a = sampleConversation({ uuid: 'aaaaaaaa-1111-0000-0000-000000000000', name: 'Même titre' });
    const b = sampleConversation({ uuid: 'aaaaaaaa-2222-0000-0000-000000000000', name: 'Même titre' });
    const { markdown } = convertExport({ placed: [entry('conversations/conversations.json', [a, b])], generatedAt: now });
    expect(paths(markdown)).toEqual(expect.arrayContaining([
      'conversations/2026-09-13-meme-titre-aaaaaaaa.md',
      'conversations/2026-09-13-meme-titre-aaaaaaaa-2.md',
    ]));
  });

  it('transmet partiel et écartés au README', () => {
    const { markdown } = convertExport({ placed: [], missing: ['conversations-000.zip'], skipped: [{ source: 'z', path: '../x', reason: 'chemin non sûr' }], generatedAt: now });
    const readme = markdown.get('README.md');
    expect(readme).toContain('**Archive partielle**');
    expect(readme).toContain('- ../x (z) : chemin non sûr');
    expect(paths(markdown)).toEqual(['README.md']);
  });
});
