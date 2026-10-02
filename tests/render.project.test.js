import { describe, it, expect } from 'vitest';
import { renderProject } from '../src/render/project.js';

const project = {
  uuid: '01a0ae9d-7eeb-7161-9ec0-42442af82411',
  name: 'Migration domaine',
  description: 'Migration domaine a.com vers b.com\n',
  is_private: true,
  is_starter_project: false,
  prompt_template: 'Réponds toujours en français.',
  created_at: '2026-09-17T09:05:52.387728+00:00',
  updated_at: '2026-09-17T09:06:00.000000+00:00',
  docs: [{ uuid: 'd-1', filename: 'plan|v1.pdf', created_at: '2026-09-17T09:10:00.000000+00:00' }],
};

describe('renderProject', () => {
  it('rend la fiche complète', () => {
    const md = renderProject(project, [
      { name: 'Première [conv]', relPath: 'conversations/2026-09-17-premiere-conv-aaaaaaaa.md', createdAt: '2026-09-17T10:00:00Z' },
    ]);
    expect(md.startsWith('# Migration domaine\n')).toBe(true);
    expect(md).toContain('- Créé : 2026-09-17 09:05 UTC');
    expect(md).toContain('- Mis à jour : 2026-09-17 09:06 UTC');
    expect(md).toContain('- UUID : `01a0ae9d-7eeb-7161-9ec0-42442af82411`');
    expect(md).toContain('- Visibilité : privé');
    expect(md).not.toContain('Projet de démarrage');
    expect(md).toContain('## Description\n\nMigration domaine a.com vers b.com\n');
    expect(md).toContain('## Instructions\n\nRéponds toujours en français.');
    expect(md).toContain('| Fichier | Créé |');
    expect(md).toContain('| plan\\|v1.pdf | 2026-09-17 09:10 UTC |');
    expect(md).toContain("_Le contenu des documents n'est pas inclus dans l'export Claude._");
    expect(md).toContain('- [Première \\[conv\\]](conversations/2026-09-17-premiere-conv-aaaaaaaa.md) — 2026-09-17 10:00 UTC');
  });

  it('gère les sections vides et les flags', () => {
    const md = renderProject({ uuid: 'p', name: '', is_private: false, is_starter_project: true, docs: [] }, []);
    expect(md.startsWith('# Projet sans nom\n')).toBe(true);
    expect(md).toContain('- Visibilité : public');
    expect(md).toContain('- Projet de démarrage : oui');
    expect(md).toContain('_Aucune description._');
    expect(md).toContain('_Aucune instruction._');
    expect(md).toContain('_Aucun document._');
    expect(md).toContain('_Aucune conversation._');
  });

  it('tolère des champs non texte et replie le titre sur une ligne', () => {
    const md = renderProject({ uuid: 'p', name: ['x'], description: 7, prompt_template: null, docs: [] }, []);
    expect(md.startsWith('# Projet sans nom\n')).toBe(true);
    expect(md).toContain('_Aucune description._');
    expect(md).toContain('_Aucune instruction._');
    expect(md).toContain('_Aucun document._');
    expect(renderProject({ ...project, name: 'Ligne 1\nLigne 2' }, []).startsWith('# Ligne 1 Ligne 2\n')).toBe(true);
  });
});
