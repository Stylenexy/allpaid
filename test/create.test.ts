import { describe, expect, it } from 'vitest';
import { fillWalletRows } from '../src/pages/Create';
import { sampleAddress } from '../src/lib/sample';

const addresses = Array.from({ length: 4 }, (_, i) => sampleAddress(`wallet-fill-${i}`, 'bitcoincash'));

describe('filling members from a wallet', () => {
  it('fills the two test rows while preserving their names and shares', () => {
    const rows = [
      { name: 'My wallet A', address: '', pct: '50' },
      { name: 'My wallet B', address: '', pct: '50' },
    ];
    expect(fillWalletRows(rows, addresses)).toEqual([
      { ...rows[0], address: addresses[0] },
      { ...rows[1], address: addresses[1] },
    ]);
    expect(rows.map((row) => row.address)).toEqual(['', '']);
  });

  it('preserves manual edits and nested jars and avoids an address already in a row', () => {
    const rows = [
      { name: 'Typed while waiting', address: ` ${addresses[0].toUpperCase()} `, pct: '25' },
      { name: 'Crew', address: 'https://example.com/jar#crew', pct: '25', jar: { name: 'Crew', members: [] } },
      { name: '', address: '', pct: '25' },
      { name: 'My name', address: '', pct: '25' },
    ];
    const filled = fillWalletRows(rows, addresses);
    expect(filled[0]).toBe(rows[0]);
    expect(filled[1]).toBe(rows[1]);
    expect(filled[2]).toEqual({ name: 'My wallet 3', address: addresses[1], pct: '25' });
    expect(filled[3]).toEqual({ name: 'My name', address: addresses[2], pct: '25' });
  });

  it('leaves pasted jar links alone even if they could not be decoded', () => {
    const row = { name: '', address: 'https://example.com/jar#broken', pct: '50', linkProblem: 'Invalid jar' };
    expect(fillWalletRows([row], addresses)[0]).toBe(row);
  });

  it('keeps filled rows on repeated clicks and gives a cleared row a different available address', () => {
    const filled = fillWalletRows([
      { name: '', address: '', pct: '50' },
      { name: '', address: '', pct: '50' },
    ], addresses);
    expect(fillWalletRows(filled, addresses)).toEqual(filled);
    const edited = [filled[0], { ...filled[1], address: '' }];
    expect(fillWalletRows(edited, addresses)[1].address).toBe(addresses[1]);
  });
});
