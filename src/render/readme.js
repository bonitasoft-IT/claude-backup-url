import { linkText, table } from './md.js';
import { formatDateTime } from '../slug.js';

export function renderReadme(r) {
  const lines = [];
  lines.push(`# Export Claude du ${r.createdAt ? formatDateTime(r.createdAt) : 'date inconnue'}`, '');
  lines.push(
    `Archive générée le ${formatDateTime(r.generatedAt.toISOString())} par Claude Export Merger. Les données JSON de l'export ont été converties en Markdown : une conversation par fichier, un dossier par projet.`,
    '',
  );

  if (r.missing.length > 0) {
    lines.push('**Archive partielle** : fichiers du manifeste manquants :', '');
    for (const m of r.missing) lines.push(`- ${m}`);
    lines.push('');
  }

  lines.push('## Compte', '');
  if (r.users.length === 0) lines.push('_Aucune information de compte dans l’export._');
  else lines.push(table(['Nom', 'E-mail'], r.users.map((u) => [u?.full_name ?? '', u?.email_address ?? ''])));

  lines.push('', '## Contenu', '');
  lines.push(`- Projets : ${r.stats.projects}`, `- Conversations : ${r.stats.conversations}`);

  lines.push('', '## Projets', '');
  if (r.projects.length === 0) lines.push('_Aucun projet._');
  else for (const p of r.projects) lines.push(`- [${linkText(p.name)}](${p.readmePath}) — ${p.conversationCount} conversation(s)`);

  lines.push('', '## Conversations sans projet', '');
  if (r.looseConversations.length === 0) lines.push('_Aucune._');
  else for (const c of r.looseConversations) lines.push(`- [${linkText(c.name)}](${c.path}) — ${formatDateTime(c.createdAt)}`);
  lines.push('');

  if (r.unconverted.length > 0) {
    lines.push('## Fichiers non convertis', '', 'Ces fichiers n’ont pas pu être lus comme JSON et sont recopiés tels quels :', '');
    for (const u of r.unconverted) lines.push(`- ${u.path} : ${u.reason}`);
    lines.push('');
  }
  if (r.skipped.length > 0) {
    lines.push('## Entrées écartées', '');
    for (const s of r.skipped) lines.push(`- ${s.path} (${s.source}) : ${s.reason}`);
    lines.push('');
  }
  if (r.passthrough.length > 0) {
    lines.push('## Fichiers recopiés tels quels', '');
    for (const p of r.passthrough) lines.push(`- ${p.path}`);
    lines.push('');
  }
  return lines.join('\n');
}
