// Sample jars for the sandbox and the landing page. The sample addresses are
// hashes of plain words: valid P2PKH addresses whose keys nobody holds, so the
// sandbox can never be mistaken for a real payout.
import { encodeCashAddress, hash160, utf8ToBin } from '@bitauth/libauth';
import type { JarConfig, Member } from './jar';

export function sampleAddress(word: string, prefix: 'bitcoincash' | 'bchtest' = 'bchtest'): string {
  return encodeCashAddress({ prefix, type: 'p2pkh', payload: hash160(utf8ToBin(`splitjar sample ${word}`)) }).address;
}

const wallet = (name: string, bps: number): Member => ({ name, bps, address: sampleAddress(name.toLowerCase()) });

/**
 * A street band whose fourth share goes to its road crew's own jar.
 * One payment, two levels, seven wallets.
 */
export const SAMPLE_BAND: JarConfig = {
  name: 'Malioboro Night Band',
  net: 'sandbox',
  members: [
    wallet('Ayu', 3000),
    wallet('Bima', 2500),
    wallet('Cahyo', 2000),
    {
      name: 'Road crew',
      bps: 2500,
      address: '',
      jar: {
        name: 'Road crew',
        members: [wallet('Dewi', 4000), wallet('Eko', 2500), wallet('Fajar', 2000), wallet('Gita', 1500)],
      },
    },
  ],
};

/** Roles shown under the sample names on the landing page. */
export const SAMPLE_ROLES: Record<string, string> = {
  Ayu: 'vocals',
  Bima: 'guitar',
  Cahyo: 'cajón',
  'Road crew': 'a jar of its own',
  Dewi: 'manager',
  Eko: 'sound',
  Fajar: 'driver',
  Gita: 'photos',
};
