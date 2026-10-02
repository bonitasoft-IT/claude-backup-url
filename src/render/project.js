import { table, linkText, text, title } from './md.js';
import { formatDateTime } from '../slug.js';

export function renderProject(project, conversations = []) {
  const lines = [];
  lines.push(`# ${title(project.name, 'Projet sans nom')}`, '');
  lines.push(`- Créé : ${formatDateTime(project.created_at)}`);
  lines.push(`- Mis à jour : ${formatDateTime(project.updated_at)}`);
  lines.push(`- UUID : \`${project.uuid ?? 'inconnu'}\``);
  lines.push(`- Visibilité : ${project.is_private ? 'privé' : 'public'}`);
  if (project.is_starter_project) lines.push('- Projet de démarrage : oui');

  lines.push('', '## Description', '', text(project.description) || '_Aucune description._');
  lines.push('', '## Instructions', '', text(project.prompt_template) || '_Aucune instruction._');

  lines.push('', '## Documents', '');
  const docs = Array.isArray(project.docs) ? project.docs : [];
  if (docs.length === 0) {
    lines.push('_Aucun document._');
  } else {
    lines.push(table(['Fichier', 'Créé'], docs.map((d) => [d?.filename ?? 'sans nom', formatDateTime(d?.created_at)])));
    lines.push('', "_Le contenu des documents n'est pas inclus dans l'export Claude._");
  }

  lines.push('', '## Conversations', '');
  if (conversations.length === 0) {
    lines.push('_Aucune conversation._');
  } else {
    for (const c of conversations) lines.push(`- [${linkText(c.name)}](${c.relPath}) — ${formatDateTime(c.createdAt)}`);
  }
  lines.push('');
  return lines.join('\n');
}
