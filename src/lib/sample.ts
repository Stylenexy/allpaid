// Sample jars for the sandbox and the landing page. The sample addresses are
// hashes of plain words: valid P2PKH addresses whose keys nobody holds, so the
// sandbox can never be mistaken for a real payout.
import { encodeCashAddress, hash160, utf8ToBin } from '@bitauth/libauth';
import type { JarConfig, Member } from './jar';
import { SAMPLE_SHAPE, type SampleMember } from './sample-shape';

export function sampleAddress(word: string, prefix: 'bitcoincash' | 'bchtest' = 'bchtest'): string {
  return encodeCashAddress({ prefix, type: 'p2pkh', payload: hash160(utf8ToBin(`allpaid sample ${word}`)) }).address;
}

const toMember = (m: SampleMember): Member =>
  m.jar
    ? { name: m.name, bps: m.bps, address: '', jar: { name: m.jar.name, members: m.jar.members.map(toMember) } }
    : { name: m.name, bps: m.bps, address: sampleAddress(m.name.toLowerCase()) };

/**
 * A street band whose fourth share goes to its road crew's own jar.
 * One payment, two levels, seven wallets.
 */
export const SAMPLE_BAND: JarConfig = {
  name: SAMPLE_SHAPE.name,
  net: 'sandbox',
  members: SAMPLE_SHAPE.members.map(toMember),
};

/** Extra context for nested sample jars. The labels themselves are roles. */
export const SAMPLE_ROLES: Record<string, string> = {
  'Road crew': 'a jar of its own',
};
