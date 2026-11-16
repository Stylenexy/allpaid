// Sample jars for the sandbox and the landing page. The sample addresses are
// hashes of plain words: valid P2PKH addresses whose keys nobody holds, so the
// sandbox can never be mistaken for a real payout.
import { encodeCashAddress, hash160, utf8ToBin } from '@bitauth/libauth';
import type { JarConfig, Member } from './jar';

export function sampleAddress(word: string, prefix: 'bitcoincash' | 'bchtest' = 'bchtest'): string {
  return encodeCashAddress({ prefix, type: 'p2pkh', payload: hash160(utf8ToBin(`kencleng sample ${word}`)) }).address;
}

const members = (rows: [string, number][]): Member[] =>
  rows.map(([name, bps]) => ({ name, bps, address: sampleAddress(name.toLowerCase()) }));

/** A three-piece street band: singer, guitarist, cajón player. */
export const SAMPLE_BAND: JarConfig = {
  name: 'Malioboro Night Band',
  net: 'sandbox',
  members: members([
    ['Ayu', 4000],
    ['Bima', 3500],
    ['Cahyo', 2500],
  ]),
};
