import { strFromU8 } from 'fflate';
import { slugify, shortId, datePrefix } from './slug.js';
import { renderConversation } from './render/conversation.js';
import { renderProject } from './render/project.js';
import { renderReadme } from './render/readme.js';
import { title } from './render/md.js';

const CONVERTIBLE = new Set(['light_metadata', 'projects', 'conversations']);

function parseJson(data) {
  try {
    return { ok: true, value: JSON.parse(strFromU8(data)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function basename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function newer(a, b) {
  return String(b?.updated_at ?? '') > String(a?.updated_at ?? '') ? b : a;
}

function dedupeByUuid(items) {
  const byUuid = new Map();
  const anonymous = [];
  for (const item of items) {
    if (!isObject(item)) continue;
    if (typeof item.uuid !== 'string' || item.uuid === '') {
      anonymous.push(item);
      continue;
    }
    byUuid.set(item.uuid, byUuid.has(item.uuid) ? newer(byUuid.get(item.uuid), item) : item);
  }
  return [...byUuid.values(), ...anonymous];
}

function uniquePath(taken, candidate) {
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  const dot = candidate.lastIndexOf('.');
  const slash = candidate.lastIndexOf('/');
  const hasExt = dot > slash;
  const stem = hasExt ? candidate.slice(0, dot) : candidate;
  const ext = hasExt ? candidate.slice(dot) : '';
  for (let n = 2; ; n++) {
    const alt = `${stem}-${n}${ext}`;
    if (!taken.has(alt)) {
      taken.add(alt);
      return alt;
    }
  }
}

function collect(placed) {
  const raw = [];
  const unconverted = [];
  const users = [];
  const projects = [];
  const conversations = [];

  const reject = (entry, reason) => {
    unconverted.push({ path: entry.path, reason });
    raw.push(entry);
  };

  for (const entry of placed) {
    const category = entry.path.split('/')[0];
    // L'historique de connexion n'est volontairement pas archivé.
    if (category === 'light_metadata' && basename(entry.path).endsWith('login_history.json')) continue;
    if (!CONVERTIBLE.has(category) || !entry.path.endsWith('.json')) {
      raw.push(entry);
      continue;
    }
    const parsed = parseJson(entry.data);
    if (!parsed.ok) {
      reject(entry, `JSON illisible (${parsed.error})`);
      continue;
    }
    const v = parsed.value;
    const name = basename(entry.path);
    if (category === 'light_metadata') {
      if (name.endsWith('users.json') && Array.isArray(v)) users.push(...v);
      else reject(entry, 'structure inattendue');
    } else if (category === 'projects') {
      if (isObject(v)) projects.push(v);
      else if (Array.isArray(v)) projects.push(...v);
      else reject(entry, 'structure inattendue');
    } else if (Array.isArray(v)) {
      conversations.push(...v);
    } else {
      reject(entry, 'structure inattendue');
    }
  }
  return { raw, unconverted, users, projects, conversations };
}

export function convertExport({ placed, missing = [], skipped = [], createdAt = null, generatedAt = new Date() }) {
  const { raw, unconverted, users, projects: projectsRaw, conversations: convsRaw } = collect(placed);

  const projects = dedupeByUuid(projectsRaw).sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'fr'));
  const conversations = dedupeByUuid(convsRaw).sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

  const markdown = new Map();
  const taken = new Set(['README.md']);

  const projectIndex = new Map();
  projects.forEach((p, i) => {
    const key = typeof p.uuid === 'string' && p.uuid !== '' ? p.uuid : `sans-uuid-${i}`;
    const folder = uniquePath(taken, `projects/${slugify(p.name)}-${shortId(p.uuid)}`);
    projectIndex.set(key, { project: p, folder, conversations: [] });
  });

  const loose = [];
  let messages = 0;
  for (const c of conversations) {
    messages += Array.isArray(c.chat_messages) ? c.chat_messages.length : 0;
    const file = `${datePrefix(c.created_at)}-${slugify(c.name)}-${shortId(c.uuid)}.md`;
    const owner = typeof c.project_uuid === 'string' ? projectIndex.get(c.project_uuid) : undefined;
    const name = title(c.name, 'Sans titre');
    if (owner) {
      const path = uniquePath(taken, `${owner.folder}/conversations/${file}`);
      const projectName = title(owner.project.name, 'Projet sans nom');
      markdown.set(path, renderConversation(c, { project: { name: projectName, readmeRelPath: '../README.md' } }));
      owner.conversations.push({ name, relPath: `conversations/${basename(path)}`, createdAt: c.created_at });
    } else {
      const path = uniquePath(taken, `conversations/${file}`);
      markdown.set(path, renderConversation(c));
      loose.push({ name, path, createdAt: c.created_at });
    }
  }

  const projectSummaries = [];
  for (const { project, folder, conversations: convs } of projectIndex.values()) {
    markdown.set(`${folder}/README.md`, renderProject(project, convs));
    projectSummaries.push({ name: title(project.name, 'Projet sans nom'), readmePath: `${folder}/README.md`, conversationCount: convs.length });
  }

  const accountUsers = users.filter(isObject).map((u) => ({ full_name: u.full_name, email_address: u.email_address }));

  const stats = { projects: projects.length, conversations: conversations.length, messages };
  markdown.set('README.md', renderReadme({
    createdAt,
    generatedAt,
    users: accountUsers,
    stats,
    projects: projectSummaries,
    looseConversations: loose,
    missing,
    skipped,
    unconverted,
    passthrough: raw.filter((r) => !unconverted.some((u) => u.path === r.path)).map((r) => ({ path: r.path })),
  }));

  return { markdown, raw, stats, unconverted };
}
