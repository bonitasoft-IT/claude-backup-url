import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

describe('environnement', () => {
  it('fflate zippe et dézippe', () => {
    const out = unzipSync(zipSync({ 'a.txt': strToU8('bonjour') }));
    expect(strFromU8(out['a.txt'])).toBe('bonjour');
  });
});
