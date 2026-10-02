import { describe, it, expect } from 'vitest';
import { renderReadme } from '../src/render/readme.js';

const full = {
  createdAt: '2026-09-17T13:21:53.420700+00:00',
  generatedAt: new Date('2026-10-02T20:30:00.000Z'),
  users: [{ full_name: 'Test User', email_address: 't@example.test' }, { full_name: 'Deux | Pipe', email_address: 'd@example.test' }],
  stats: { projects: 1, conversations: 2, messages: 5 },
  projects: [{ name: 'Migration [v2]', readmePath: 'projects/migration-v2-01a0ae9d/README.md', conversationCount: 1 }],
  looseConversations: [{ name: 'Libre | test', path: 'conversations/2026-09-13-libre-test-155a6a46.md', createdAt: '2026-09-13T11:08:52Z' }],
  missing: [],
  skipped: [],
  unconverted: [],
  passthrough: [],
};

describe('renderReadme', () => {
  it('rend un index complet', () => {
    const md = renderReadme(full);
    expect(md.startsWith('# Export Claude du 2026-09-17 13:21 UTC\n')).toBe(true);
    expect(md).toContain('Archive générée le 2026-10-02 20:30 UTC');
    expect(md).toContain('converties en Markdown');
    expect(md).not.toContain('Archive partielle');
    expect(md).toContain('## Compte\n\n| Nom | E-mail |\n| --- | --- |\n| Test User | t@example.test |\n| Deux \\| Pipe | d@example.test |\n');
    expect(md).not.toContain('compte.md');
    expect(md).toContain('- Projets : 1\n- Conversations : 2\n');
    expect(md).not.toContain('Messages');
    expect(md).toContain('- [Migration \\[v2\\]](projects/migration-v2-01a0ae9d/README.md) — 1 conversation(s)');
    expect(md).toContain('- [Libre | test](conversations/2026-09-13-libre-test-155a6a46.md) — 2026-09-13 11:08 UTC');
    expect(md).not.toContain('## Fichiers non convertis');
    expect(md).not.toContain('## Entrées écartées');
    expect(md).not.toContain('## Fichiers recopiés tels quels');
  });

  it('signale partiel, non convertis, écartés et inconnus', () => {
    const md = renderReadme({
      ...full,
      missing: ['conversations-000.zip'],
      unconverted: [{ path: 'conversations/conversations.json', reason: 'JSON illisible (Unexpected token)' }],
      skipped: [{ source: 'projects-000.zip', path: '../x', reason: 'chemin non sûr' }],
      passthrough: [{ path: 'unknown/autre/note.txt' }],
    });
    expect(md).toContain('**Archive partielle**');
    expect(md).toContain('- conversations-000.zip');
    expect(md).toContain('## Fichiers non convertis\n\n');
    expect(md).toContain('- conversations/conversations.json : JSON illisible (Unexpected token)');
    expect(md).toContain('## Entrées écartées\n\n- ../x (projects-000.zip) : chemin non sûr');
    expect(md).toContain('## Fichiers recopiés tels quels\n\n- unknown/autre/note.txt');
  });

  it("gère l'absence de compte, de projets et de conversations", () => {
    const md = renderReadme({ ...full, createdAt: null, users: [], projects: [], looseConversations: [] });
    expect(md.startsWith('# Export Claude du date inconnue\n')).toBe(true);
    expect(md).toContain("_Aucune information de compte dans l’export._");
    expect(md).toContain('## Projets\n\n_Aucun projet._');
    expect(md).toContain('## Conversations sans projet\n\n_Aucune._');
  });

  it('tolère un utilisateur sans nom ni e-mail', () => {
    const md = renderReadme({ ...full, users: [{}] });
    expect(md).toContain('| Nom | E-mail |\n| --- | --- |\n|  |  |');
  });
});
