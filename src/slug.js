export function slugify(text, max = 60) {
  const base = String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return base || 'sans-titre';
}

export function shortId(uuid) {
  return String(uuid ?? '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 8) || 'inconnu';
}

export function datePrefix(iso) {
  const d = new Date(iso ?? NaN);
  return Number.isNaN(d.getTime()) ? 'date-inconnue' : d.toISOString().slice(0, 10);
}

export function formatDateTime(iso) {
  if (iso === null || iso === undefined || iso === '') return 'date inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

export function formatDateLong(iso) {
  if (iso === null || iso === undefined || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${LONG_DATE.format(d)} à ${d.toISOString().slice(11, 16)} UTC`;
}
