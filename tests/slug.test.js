import { describe, it, expect } from 'vitest';
import { slugify, shortId, datePrefix, formatDateTime } from '../src/slug.js';

describe('slugify', () => {
  it('normalise accents, casse et ponctuation', () => {
    expect(slugify('Migration domaine')).toBe('migration-domaine');
    expect(slugify('Éléphant & café !')).toBe('elephant-cafe');
    expect(slugify("Supprimer l'historique Claude")).toBe('supprimer-l-historique-claude');
  });
  it('replie sur sans-titre pour vide, null, ou uniquement des symboles', () => {
    expect(slugify('')).toBe('sans-titre');
    expect(slugify(null)).toBe('sans-titre');
    expect(slugify('***')).toBe('sans-titre');
  });
  it('tronque à 60 caractères sans tiret final', () => {
    const long = 'a'.repeat(59) + '-bcd';
    const out = slugify(long);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('-')).toBe(false);
    expect(out).toBe('a'.repeat(59));
  });
});

describe('shortId', () => {
  it('prend les 8 premiers hex sans tirets', () => {
    expect(shortId('01a0ae9d-7eeb-7161-9ec0-42442af82411')).toBe('01a0ae9d');
  });
  it('ne garde que de l’hexadécimal', () => {
    expect(shortId('/../../x')).toBe('inconnu');
    expect(shortId('ZZ-01A0ae9d-7eeb')).toBe('01a0ae9d');
    expect(shortId('/../../.ab12')).toBe('ab12');
  });
  it('replie sur inconnu', () => {
    expect(shortId(undefined)).toBe('inconnu');
    expect(shortId('')).toBe('inconnu');
  });
});

describe('datePrefix', () => {
  it('extrait la date UTC', () => {
    expect(datePrefix('2026-09-13T11:08:52.748765Z')).toBe('2026-09-13');
    expect(datePrefix('2026-09-17T13:21:53.420700+00:00')).toBe('2026-09-17');
  });
  it('replie sur date-inconnue', () => {
    expect(datePrefix('pas une date')).toBe('date-inconnue');
    expect(datePrefix(undefined)).toBe('date-inconnue');
  });
});

describe('formatDateTime', () => {
  it('formate en UTC à la minute', () => {
    expect(formatDateTime('2026-09-13T11:08:52.748765Z')).toBe('2026-09-13 11:08 UTC');
  });
  it('gère absent et illisible', () => {
    expect(formatDateTime(null)).toBe('date inconnue');
    expect(formatDateTime(undefined)).toBe('date inconnue');
    expect(formatDateTime('')).toBe('date inconnue');
    expect(formatDateTime('n/a')).toBe('n/a');
  });
});
