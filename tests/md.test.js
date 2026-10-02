import { describe, it, expect } from 'vitest';
import { fence, cell, table, linkText, text, title, escapeHtml } from '../src/render/md.js';

describe('fence', () => {
  it('utilise trois backticks par défaut avec le langage', () => {
    expect(fence('{ "a": 1 }', 'json')).toBe('```json\n{ "a": 1 }\n```');
  });
  it('allonge la clôture si le contenu contient des backticks', () => {
    const body = 'avant\n```js\ncode\n```\naprès';
    const out = fence(body);
    expect(out.startsWith('````\n')).toBe(true);
    expect(out.endsWith('\n````')).toBe(true);
    expect(out).toContain(body);
  });
  it('supporte un très grand nombre de runs de backticks', () => {
    const out = fence(Array.from({ length: 300000 }, () => '`a').join(''));
    expect(out.startsWith('```\n')).toBe(true);
  });
  it('tolère null', () => {
    expect(fence(null)).toBe('```\n\n```');
  });
});

describe('cell et table', () => {
  it('échappe | et remplace les sauts de ligne', () => {
    expect(cell('a|b\nc')).toBe('a\\|b c');
    expect(cell(null)).toBe('');
  });
  it('rend un tableau GFM', () => {
    expect(table(['A', 'B'], [['1', 'x|y'], [2, null]])).toBe(
      '| A | B |\n| --- | --- |\n| 1 | x\\|y |\n| 2 |  |',
    );
  });
});

describe('linkText', () => {
  it('échappe les crochets', () => {
    expect(linkText('Titre [v2] ok')).toBe('Titre \\[v2\\] ok');
    expect(linkText(null)).toBe('');
  });
});

describe('text et title', () => {
  it('text ne garde que les chaînes, trimées', () => {
    expect(text('  a ')).toBe('a');
    expect(text(42)).toBe('');
    expect(text(['x'])).toBe('');
    expect(text(null)).toBe('');
  });
  it('title replie sur une ligne et sur le repli', () => {
    expect(title('Ligne 1\nLigne 2', 'F')).toBe('Ligne 1 Ligne 2');
    expect(title('  ', 'F')).toBe('F');
    expect(title(7, 'F')).toBe('F');
  });
});

describe('escapeHtml', () => {
  it('échappe & < > "', () => {
    expect(escapeHtml('<b a="1">&</b>')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
  });
});
