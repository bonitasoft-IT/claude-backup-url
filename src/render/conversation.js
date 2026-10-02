import { fence, linkText, text, title } from './md.js';
import { formatDateLong } from '../slug.js';

const SENDER_LABEL = { human: 'Humain', assistant: 'Assistant' };

function senderLabel(sender) {
  if (sender === null || sender === undefined || sender === '') return 'Inconnu';
  return SENDER_LABEL[sender] ?? String(sender);
}

function sortedMessages(messages) {
  const list = Array.isArray(messages) ? [...messages] : [];
  const times = list.map((m) => new Date(m?.created_at ?? NaN).getTime());
  if (times.some(Number.isNaN)) return list;
  return list.map((m, i) => ({ m, t: times[i] })).sort((a, b) => a.t - b.t).map((x) => x.m);
}

// --- Texte des messages : titres décalés, blocs de code refermés ---

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const HEADING_RE = /^(\s{0,3})(#{1,6})(\s|$)/;

function prepareText(raw) {
  let open = null;
  const out = raw.split('\n').map((line) => {
    const m = FENCE_RE.exec(line);
    if (open) {
      if (m && m[1][0] === open.char && m[1].length >= open.length && m[2].trim() === '') open = null;
      return line;
    }
    if (m) {
      open = { char: m[1][0], length: m[1].length };
      return line;
    }
    return line.replace(HEADING_RE, (_, indent, hashes, after) => `${indent}${'#'.repeat(Math.min(6, hashes.length + 2))}${after}`);
  });
  if (open) out.push(open.char.repeat(open.length));
  return out.join('\n');
}

// --- Appels d'outils : rendus comme dans l'interface, jamais en JSON ---

const PATH_KEYS = ['path', 'file_path', 'filepath', 'filename'];
const BODY_KEYS = ['file_text', 'content', 'contents', 'text', 'code', 'body'];
const SUMMARY_KEYS = ['query', 'url', 'path', 'command', 'prompt', 'question', 'description', 'name'];
const LANG_BY_EXT = {
  js: 'js', mjs: 'js', cjs: 'js', ts: 'ts', tsx: 'tsx', jsx: 'jsx', py: 'py', rb: 'rb', go: 'go', rs: 'rust', java: 'java',
  kt: 'kotlin', cs: 'csharp', php: 'php', sh: 'sh', bash: 'bash', zsh: 'sh', ps1: 'powershell', sql: 'sql',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', html: 'html', htm: 'html', css: 'css', scss: 'scss',
  csv: 'csv', ini: 'ini', dockerfile: 'dockerfile', tex: 'latex', r: 'r', swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
};
const LANG_BY_ARTIFACT_TYPE = {
  'text/html': 'html', 'image/svg+xml': 'xml', 'application/vnd.ant.react': 'jsx', 'application/vnd.ant.mermaid': 'mermaid',
};
const PLACEHOLDER_RE = /```\s*This block is not supported on your current device yet\.\s*```/g;

function str(input, key) {
  const v = input[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function firstString(input, keys) {
  for (const key of keys) {
    const v = str(input, key);
    if (v !== null) return v;
  }
  return null;
}

function codeSpan(value) {
  const s = String(value);
  let longest = 0;
  for (const m of s.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  const ticks = '`'.repeat(longest + 1);
  return longest === 0 ? `${ticks}${s}${ticks}` : `${ticks} ${s} ${ticks}`;
}

function inlineText(value) {
  return String(value).replace(/[\\_*[\]<>]/g, '\\$&');
}

function basename(path) {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
}

function extension(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function trimEnd(body) {
  return body.replace(/\n+$/, '');
}

function renderInlineMarkdown(label, body, endMarker) {
  return `${label}\n\n${prepareText(body.trim())}\n\n${endMarker}`;
}

function renderCreatedFile(name, input, body) {
  const path = firstString(input, PATH_KEYS);
  const file = path === null ? '' : basename(path);
  if (file === '') return `**Contenu produit par l’outil ${name}**\n\n${fence(trimEnd(body))}`;
  const ext = extension(file);
  if (ext === 'md' || ext === 'markdown') {
    return renderInlineMarkdown(`**Fichier créé : ${codeSpan(file)}**`, body, `_Fin du fichier ${codeSpan(file)}_`);
  }
  return `**Fichier créé : ${codeSpan(file)}**\n\n${fence(trimEnd(body), LANG_BY_EXT[ext] ?? '')}`;
}

function renderArtifact(input) {
  const title = str(input, 'title');
  const shownTitle = title === null ? null : inlineText(title.trim());
  const content = str(input, 'content');
  const isCreate = (str(input, 'command') ?? 'create') === 'create';
  if (content === null) {
    const base = isCreate ? 'Artéfact' : 'Mise à jour de l’artéfact';
    return `_${base}${shownTitle === null ? '' : ` « ${shownTitle} »`}_`;
  }
  const label = `**${isCreate ? 'Artéfact' : 'Artéfact mis à jour'} : ${shownTitle ?? 'sans titre'}**`;
  const type = str(input, 'type') ?? '';
  if (type === 'text/markdown') {
    return renderInlineMarkdown(label, content, `_Fin de l’artéfact « ${shownTitle ?? 'sans titre'} »_`);
  }
  const lang = str(input, 'language') ?? LANG_BY_ARTIFACT_TYPE[type] ?? '';
  return `${label}\n\n${fence(trimEnd(content), lang.trim())}`;
}

function renderCommand(input) {
  const command = str(input, 'command');
  if (command === null) return '_Commande exécutée_';
  if (command.includes('\n')) return `**Commande exécutée**\n\n${fence(trimEnd(command), 'sh')}`;
  return `_Commande : ${codeSpan(command.trim())}_`;
}

function describeTool(name, input) {
  switch (name) {
    case 'web_search': {
      const q = str(input, 'query');
      return q === null ? 'Recherche web' : `Recherche web : « ${inlineText(q.trim())} »`;
    }
    case 'web_fetch': {
      const u = str(input, 'url');
      return u === null ? 'Lecture d’une page web' : `Lecture de la page ${inlineText(u.trim())}`;
    }
    case 'view': {
      const p = str(input, 'path');
      return p === null ? 'Lecture d’un fichier' : `Lecture du fichier ${codeSpan(p.trim())}`;
    }
    case 'present_files': {
      const files = Array.isArray(input.filepaths)
        ? input.filepaths.filter((f) => typeof f === 'string' && basename(f) !== '').map((f) => codeSpan(basename(f)))
        : [];
      return files.length > 0 ? `Fichiers présentés : ${files.join(', ')}` : 'Fichiers présentés';
    }
    case 'memory_user_edits': return 'Mise à jour de la mémoire';
    case 'recent_chats': return 'Consultation des conversations récentes';
    default: {
      if (name.startsWith('ask_user_input')) return 'Question posée à l’utilisateur';
      const summary = firstString(input, SUMMARY_KEYS);
      return summary === null || summary.includes('\n') ? `Outil ${name}` : `Outil ${name} : ${inlineText(summary.trim())}`;
    }
  }
}

function isFileLike(input, body) {
  return body !== null && (firstString(input, PATH_KEYS) !== null || str(input, 'file_text') !== null || body.includes('\n'));
}

function renderToolUse(block) {
  const name = text(block.name) || 'inconnu';
  const input = block.input && typeof block.input === 'object' && !Array.isArray(block.input) ? block.input : {};
  if (name === 'artifacts') return renderArtifact(input);
  if (name === 'bash' || name === 'bash_tool') return renderCommand(input);
  const body = firstString(input, BODY_KEYS);
  if (isFileLike(input, body)) return renderCreatedFile(name, input, body);
  return `_${describeTool(name, input)}_`;
}

function renderToolResult(block) {
  if (!block.is_error) return null;
  return `_(échec de l’outil ${text(block.name) || 'inconnu'})_`;
}

export function renderMessageBody(message) {
  const parts = [];
  const blocks = Array.isArray(message?.content) ? message.content : [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text') {
      const t = typeof block.text === 'string' ? block.text.trim() : '';
      if (t !== '') parts.push(prepareText(t));
    } else if (block.type === 'tool_use') {
      parts.push(renderToolUse(block));
    } else if (block.type === 'tool_result') {
      const line = renderToolResult(block);
      if (line !== null) parts.push(line);
    }
  }
  if (parts.length === 0 && typeof message?.text === 'string') {
    const fallback = message.text.replace(PLACEHOLDER_RE, '').trim();
    if (fallback !== '') parts.push(prepareText(fallback));
  }
  return parts.length === 0 ? '_(message vide)_' : parts.join('\n\n');
}

function headerLine(conv, project) {
  const when = formatDateLong(conv.created_at);
  let line = when === null ? 'Conversation (date inconnue)' : `Conversation du ${when}`;
  if (project) line += ` · Projet : [${linkText(title(project.name, 'Projet sans nom'))}](${project.readmeRelPath})`;
  else if (conv.project_uuid) line += ' · Projet inconnu';
  return line;
}

export function renderConversation(conv, { project = null } = {}) {
  const messages = sortedMessages(conv.chat_messages);
  const lines = [];
  lines.push(`# ${title(conv.name, 'Sans titre')}`, '');
  lines.push(headerLine(conv, project));
  const summary = text(conv.summary);
  if (summary !== '') lines.push('', `> ${summary.replace(/\r?\n/g, '\n> ')}`);
  lines.push('', '---');
  for (const m of messages) {
    lines.push('', `## ${senderLabel(m?.sender)}`, '', renderMessageBody(m));
  }
  lines.push('');
  return lines.join('\n');
}
