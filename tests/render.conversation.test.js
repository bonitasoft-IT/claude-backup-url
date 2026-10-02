import { describe, it, expect } from 'vitest';
import { renderConversation, renderMessageBody } from '../src/render/conversation.js';

const text = (t) => ({ type: 'text', text: t });
const msg = (sender, created_at, content, extra = {}) => ({
  uuid: `m-${created_at}`,
  sender,
  created_at,
  updated_at: created_at,
  text: content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') || '\n```\nThis block is not supported on your current device yet.\n```\n',
  content,
  ...extra,
});
const assistant = (content) => msg('assistant', '2026-09-13T11:09:00.000000Z', content);

const base = {
  uuid: '155a6a46-bf11-46eb-9f53-3e59f071ee6a',
  name: 'Supprimer l’historique',
  summary: '',
  created_at: '2026-09-13T11:08:52.748765Z',
  updated_at: '2026-09-13T11:09:01.576624Z',
  project_uuid: null,
  chat_messages: [
    assistant([text('Voici comment faire.')]),
    msg('human', '2026-09-13T11:08:53.000000Z', [text('comment supprimer tout l’historique')]),
  ],
};

describe('renderConversation — en-tête', () => {
  it('rend titre, phrase de date, séparateur, et messages triés par date sans horodatage', () => {
    const md = renderConversation(base);
    expect(md.startsWith('# Supprimer l’historique\n\nConversation du 13 septembre 2026 à 11:08 UTC\n\n---\n')).toBe(true);
    expect(md).not.toContain('UUID');
    expect(md).not.toContain('Messages :');
    expect(md).not.toContain('Mise à jour');
    const human = md.indexOf('\n## Humain\n');
    const assistantIdx = md.indexOf('\n## Assistant\n');
    expect(human).toBeGreaterThan(0);
    expect(assistantIdx).toBeGreaterThan(human);
    expect(md).not.toMatch(/## (Humain|Assistant) —/);
    expect(md).toContain('comment supprimer tout l’historique');
    expect(md).toContain('Voici comment faire.');
  });

  it('ajoute le projet rattaché, ou « Projet inconnu », et le résumé', () => {
    const withProject = renderConversation({ ...base, project_uuid: 'p-1', summary: 'Résumé\nsur deux lignes' }, { project: { name: 'Migration [v2]', readmeRelPath: '../README.md' } });
    expect(withProject).toContain('Conversation du 13 septembre 2026 à 11:08 UTC · Projet : [Migration \\[v2\\]](../README.md)\n');
    expect(withProject).toContain('> Résumé\n> sur deux lignes');
    const unknown = renderConversation({ ...base, project_uuid: 'p-404' });
    expect(unknown).toContain('Conversation du 13 septembre 2026 à 11:08 UTC · Projet inconnu\n');
  });

  it('gère une date absente ou illisible', () => {
    expect(renderConversation({ ...base, created_at: null })).toContain('\nConversation (date inconnue)\n');
    expect(renderConversation({ ...base, created_at: 'n/a' })).toContain('\nConversation (date inconnue)\n');
  });

  it('garde l’ordre d’origine si une date de message est illisible', () => {
    const conv = { ...base, chat_messages: [
      msg('assistant', 'n/a', [text('Bravo')]),
      msg('human', '2026-09-13T11:08:53.000000Z', [text('Allo')]),
    ] };
    const md = renderConversation(conv);
    expect(md.indexOf('Bravo')).toBeLessThan(md.indexOf('Allo'));
  });

  it('utilise les blocs content, pas le champ text avec placeholder', () => {
    const md = renderConversation({ ...base, chat_messages: [assistant([text('Réponse réelle')])] });
    expect(md).toContain('Réponse réelle');
    expect(md).not.toContain('This block is not supported');
  });

  it('tolère un nom non texte, un titre multi-ligne, chat_messages absent', () => {
    expect(renderConversation({ ...base, name: 42 }).startsWith('# Sans titre\n')).toBe(true);
    expect(renderConversation({ ...base, name: 'Ligne 1\nLigne 2' }).startsWith('# Ligne 1 Ligne 2\n')).toBe(true);
    const md = renderConversation({ ...base, chat_messages: undefined });
    expect(md).toContain('---');
    expect(md).not.toContain('## ');
  });

  it('marque un message vide et un expéditeur inconnu, replie sur message.text', () => {
    const md = renderConversation({ ...base, chat_messages: [
      { sender: undefined, created_at: '2026-09-13T11:08:53.000000Z', text: '', content: [] },
      { sender: 'human', created_at: '2026-09-13T11:08:54.000000Z', text: 'texte brut', content: [] },
    ] });
    expect(md).toContain('\n## Inconnu\n\n_(message vide)_');
    expect(md).toContain('texte brut');
  });
});

describe('renderMessageBody — outils', () => {
  it('ignore thinking et les résultats d’outils, rend une recherche web en une ligne', () => {
    const body = renderMessageBody({ content: [
      { type: 'thinking', thinking: 'secret' },
      { type: 'tool_use', name: 'web_search', input: { query: 'claude export' } },
      { type: 'tool_result', name: 'web_search', is_error: false, content: [{ type: 'knowledge', text: 'Résultat 1' }, 'brut'] },
      text('Conclusion'),
    ] });
    expect(body).toBe('_Recherche web : « claude export »_\n\nConclusion');
    expect(body).not.toContain('secret');
    expect(body).not.toContain('json');
    expect(body).not.toContain('<details>');
  });

  it('rend les autres outils connus en une ligne lisible', () => {
    const line = (name, input) => renderMessageBody({ content: [{ type: 'tool_use', name, input }] });
    expect(line('web_fetch', { url: 'https://example.test/page' })).toBe('_Lecture de la page https://example.test/page_');
    expect(line('view', { path: '/mnt/user-data/notes.md', description: 'x' })).toBe('_Lecture du fichier `/mnt/user-data/notes.md`_');
    expect(line('present_files', { filepaths: ['/a/b.md', '/a/c.py'] })).toBe('_Fichiers présentés : `b.md`, `c.py`_');
    expect(line('memory_user_edits', { command: 'add', control: '...' })).toBe('_Mise à jour de la mémoire_');
    expect(line('recent_chats', { n: 5 })).toBe('_Consultation des conversations récentes_');
    expect(line('ask_user_input_v0', { questions: [{ q: 1 }] })).toBe('_Question posée à l’utilisateur_');
    expect(line('bash', { command: 'ls -la' })).toBe('_Commande : `ls -la`_');
  });

  it('rend un outil inconnu avec son premier paramètre court, sans JSON', () => {
    expect(renderMessageBody({ content: [{ type: 'tool_use', name: 'custom_tool', input: { flag: true, prompt: 'faire ceci' } }] })).toBe('_Outil custom_tool : faire ceci_');
    expect(renderMessageBody({ content: [{ type: 'tool_use', name: 'custom_tool', input: { n: 3 } }] })).toBe('_Outil custom_tool_');
    expect(renderMessageBody({ content: [{ type: 'tool_use', input: {} }] })).toBe('_Outil inconnu_');
  });

  it('inline un fichier Markdown créé, titres décalés, sans JSON', () => {
    const body = renderMessageBody({ content: [{ type: 'tool_use', name: 'create_file', input: {
      path: '/mnt/user-data/outputs/memoire.md',
      file_text: '# Mémoire\n\n## Section\n\nContenu',
      description: 'Export',
    } }] });
    expect(body).toBe('**Fichier créé : `memoire.md`**\n\n### Mémoire\n\n#### Section\n\nContenu\n\n_Fin du fichier `memoire.md`_');
  });

  it('met un fichier non Markdown créé dans un bloc de code typé par l’extension', () => {
    const py = renderMessageBody({ content: [{ type: 'tool_use', name: 'create_file', input: { path: 'scripts/run.py', file_text: 'print(1)\nprint(2)' } }] });
    expect(py).toBe('**Fichier créé : `run.py`**\n\n```py\nprint(1)\nprint(2)\n```');
    const txt = renderMessageBody({ content: [{ type: 'tool_use', name: 'create_file', input: { path: 'notes', content: 'a\nb' } }] });
    expect(txt).toBe('**Fichier créé : `notes`**\n\n```\na\nb\n```');
    const noPath = renderMessageBody({ content: [{ type: 'tool_use', name: 'str_replace_based_edit_tool', input: { command: 'create', file_text: 'x\ny' } }] });
    expect(noPath).toBe('**Contenu produit par l’outil str_replace_based_edit_tool**\n\n```\nx\ny\n```');
  });

  it('allonge la fence si le fichier créé contient des backticks', () => {
    const body = renderMessageBody({ content: [{ type: 'tool_use', name: 'create_file', input: { path: 'a.sh', file_text: 'x\n```\ny\n```' } }] });
    expect(body).toContain('````sh\nx\n```\ny\n```\n````');
  });

  it('signale seulement les résultats en erreur', () => {
    const body = renderMessageBody({ content: [
      { type: 'tool_result', name: 'web_fetch', is_error: true, content: 'Timeout' },
      { type: 'tool_result', name: 'view', is_error: false, content: 'ok' },
    ] });
    expect(body).toBe('_(échec de l’outil web_fetch)_');
  });
});

describe('renderMessageBody — outils (robustesse)', () => {
  const use = (name, input) => renderMessageBody({ content: [{ type: 'tool_use', name, input }] });

  it('rend une commande multi-ligne en bloc sh et une commande à backticks en code span allongé', () => {
    expect(use('bash_tool', { command: '# Setup\nnpm install\n\necho ok' })).toBe('**Commande exécutée**\n\n```sh\n# Setup\nnpm install\n\necho ok\n```');
    expect(use('bash', { command: 'echo `date`' })).toBe('_Commande : `` echo `date` ``_');
    expect(use('bash_tool', { command: 'ls' })).toBe('_Commande : `ls`_');
  });

  it('rend les artéfacts : Markdown inliné, code typé, mise à jour sans contenu', () => {
    expect(use('artifacts', { command: 'create', id: 'a1', type: 'text/markdown', title: 'Plan', content: '# Plan\n\nÉtape 1' }))
      .toBe('**Artéfact : Plan**\n\n### Plan\n\nÉtape 1\n\n_Fin de l’artéfact « Plan »_');
    expect(use('artifacts', { command: 'create', id: 'a2', type: 'application/vnd.ant.code', language: 'python', title: 'Script', content: 'print(1)' }))
      .toBe('**Artéfact : Script**\n\n```python\nprint(1)\n```');
    expect(use('artifacts', { command: 'rewrite', id: 'a3', type: 'text/html', title: 'Page', content: '<p>x</p>\n' }))
      .toBe('**Artéfact mis à jour : Page**\n\n```html\n<p>x</p>\n```');
    expect(use('artifacts', { command: 'update', id: 'a1', old_str: 'a', new_str: 'b' })).toBe('_Mise à jour de l’artéfact_');
    expect(use('artifacts', { command: 'update', id: 'a1', title: 'Plan', old_str: 'a', new_str: 'b' })).toBe('_Mise à jour de l’artéfact « Plan »_');
  });

  it('termine un fichier Markdown inliné par un marqueur et referme un bloc ouvert dedans', () => {
    const body = use('create_file', { path: 'C:\\x\\notes.MD', file_text: '# N\n```js\nlet a;' });
    expect(body).toBe('**Fichier créé : `notes.MD`**\n\n### N\n```js\nlet a;\n```\n\n_Fin du fichier `notes.MD`_');
  });

  it('inclut un fichier créé même sur une seule ligne quand un chemin est présent', () => {
    expect(use('create_file', { path: '/x/a.txt', file_text: 'une ligne' })).toBe('**Fichier créé : `a.txt`**\n\n```\nune ligne\n```');
  });

  it('ne traite pas comme fichier un outil sans chemin ni clé de fichier, mais avec un texte multi-ligne', () => {
    expect(use('send_message', { to: 'bob', text: 'Bonjour\nà tous' })).toBe('**Contenu produit par l’outil send_message**\n\n```\nBonjour\nà tous\n```');
    expect(use('str_replace', { path: '/x/a.py', old_str: 'a\nb', new_str: 'c\nd' })).toBe('_Outil str_replace : /x/a.py_');
  });

  it('retire les sauts de ligne finaux et neutralise les backticks des noms', () => {
    expect(use('create_file', { path: 'a.py', file_text: 'x\n\n' })).toBe('**Fichier créé : `a.py`**\n\n```py\nx\n```');
    expect(use('create_file', { path: 'we`ird.py', file_text: 'x' })).toBe('**Fichier créé : `` we`ird.py ``**\n\n```py\nx\n```');
    expect(use('create_file', { path: '/', file_text: 'x\ny' })).toBe('**Contenu produit par l’outil create_file**\n\n```\nx\ny\n```');
  });

  it('ignore un paramètre non texte et échappe le Markdown dans les lignes d’outil', () => {
    expect(use('web_search', { query: 42 })).toBe('_Recherche web_');
    expect(use('web_search', { query: 'a_b *c* [d] <e>' })).toBe('_Recherche web : « a\\_b \\*c\\* \\[d\\] \\<e\\> »_');
  });

  it('ne laisse pas passer le placeholder du champ text en repli', () => {
    const body = renderMessageBody({ text: '\n```\nThis block is not supported on your current device yet.\n```\n', content: [{ type: 'thinking', thinking: 'x' }, { type: 'tool_result', name: 'view', content: 'ok' }] });
    expect(body).toBe('_(message vide)_');
  });
});

describe('renderMessageBody — texte', () => {
  it('joint les blocs par une ligne vide', () => {
    expect(renderMessageBody({ content: [text(' a '), text('b')] })).toBe('a\n\nb');
  });

  it('décale les titres ATX de deux niveaux hors blocs de code', () => {
    const body = renderMessageBody({ content: [text('# Titre\n\n## Section\n\ntexte\n\n```\n# pas un titre\n```\n\n##### cinq\n\n###### six\n\n#hashtag')] });
    expect(body).toContain('### Titre\n\n#### Section');
    expect(body).toContain('```\n# pas un titre\n```');
    expect(body).toContain('###### cinq\n\n###### six');
    expect(body).toContain('#hashtag');
  });

  it('referme un bloc de code resté ouvert, aussi dans le repli message.text', () => {
    expect(renderMessageBody({ content: [text('Code :\n```js\nlet a = 1;')] })).toBe('Code :\n```js\nlet a = 1;\n```');
    expect(renderMessageBody({ content: [text('````\n```\nx\n```')] })).toBe('````\n```\nx\n```\n````');
    expect(renderMessageBody({ content: [text('a\n```\nb\n```\nc')] })).toBe('a\n```\nb\n```\nc');
    expect(renderMessageBody({ content: [], text: '# T\n```\nx' })).toBe('### T\n```\nx\n```');
  });

  it('ne laisse pas un bloc ouvert englober le message suivant', () => {
    const md = renderConversation({ ...base, chat_messages: [
      msg('human', '2026-09-13T11:08:53.000000Z', [text('```py\nprint(1)')]),
      assistant([text('Réponse')]),
    ] });
    const before = md.slice(0, md.indexOf('\n## Assistant\n'));
    expect(before.split('\n').filter((l) => /^\s{0,3}(`{3,}|~{3,})/.test(l)).length % 2).toBe(0);
  });
});
