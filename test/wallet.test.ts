import { describe, expect, it, vi } from 'vitest';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import type { NetworkProvider, SpendableUtxo } from 'cashscript';
import { binToHex, cashAddressToLockingBytecode, sha256 } from '@bitauth/libauth';
import { freshReceiveAddresses, GAP_LIMIT, MAX_SCAN, receiveAddresses } from '../src/lib/wallet';

function fakeManager() {
  const getPubkey = vi.fn((child: number, index: bigint) => {
    const key = new Uint8Array(33);
    key[0] = 2;
    key[1] = child;
    new DataView(key.buffer).setBigUint64(25, index);
    return key;
  });
  return { manager: { getPubkey } as unknown as DappConnectionManager, getPubkey };
}

function scriptHash(address: string): string {
  const lock = cashAddressToLockingBytecode(address);
  if (typeof lock === 'string') throw new Error(lock);
  return binToHex(Uint8Array.from(sha256.hash(lock.bytecode)).reverse());
}

const coin: SpendableUtxo = { txid: '00'.repeat(32), vout: 0, satoshis: 1000n, lockingBytecode: '51' };

describe('receive addresses', () => {
  it.each(['mainnet', 'chipnet'] as const)('derives distinct valid %s cashaddrs on the receive path', (net) => {
    const { manager, getPubkey } = fakeManager();
    const addresses = receiveAddresses(manager, net, 4);
    expect(new Set(addresses).size).toBe(4);
    for (const address of addresses) {
      expect(address.startsWith(net === 'mainnet' ? 'bitcoincash:' : 'bchtest:')).toBe(true);
      const decoded = cashAddressToLockingBytecode(address);
      expect(typeof decoded).not.toBe('string');
      if (typeof decoded !== 'string') expect(decoded.bytecode).toHaveLength(25);
    }
    expect(getPubkey.mock.calls).toEqual([[0, 0n], [0, 1n], [0, 2n], [0, 3n]]);
  });

  it('respects the start index and returns no addresses for a zero count', () => {
    const { manager, getPubkey } = fakeManager();
    expect(receiveAddresses(manager, 'mainnet', 2, 3)).toEqual(receiveAddresses(manager, 'mainnet', 5).slice(3));
    getPubkey.mockClear();
    expect(receiveAddresses(manager, 'mainnet', 0)).toEqual([]);
    expect(getPubkey).not.toHaveBeenCalled();
  });

  it('reports missing shared public keys', async () => {
    const manager = { getPubkey: () => null } as unknown as DappConnectionManager;
    const getUtxos = vi.fn();
    const provider = { getUtxos } as unknown as NetworkProvider;
    expect(() => receiveAddresses(manager, 'mainnet', 1)).toThrow('did not share receive public keys');
    await expect(freshReceiveAddresses(manager, 'mainnet', provider, 1)).rejects.toThrow('did not share receive public keys');
    expect(getUtxos).not.toHaveBeenCalled();
  });

  it('rejects invalid ranges before deriving addresses', () => {
    const { manager, getPubkey } = fakeManager();
    for (const [count, start] of [[-1, 0], [1.5, 0], [1, -1], [1, 0.5], [NaN, 0], [1, Number.MAX_SAFE_INTEGER]]) {
      expect(() => receiveAddresses(manager, 'mainnet', count, start)).toThrow('non-negative integers');
    }
    expect(getPubkey).not.toHaveBeenCalled();
  });
});

describe('fresh receive addresses', () => {
  it.each(['mainnet', 'chipnet'] as const)('skips spent and funded addresses using %s history', async (net) => {
    const { manager } = fakeManager();
    const addresses = receiveAddresses(manager, net, 6);
    const used = new Set([0, 2, 3].map((index) => scriptHash(addresses[index])));
    const performRequest = vi.fn(async (_method: string, hash: string) => used.has(hash) ? [{ tx_hash: 'old' }] : []);
    // No coins remain at index 0, but its history must still exclude it.
    const getUtxos = vi.fn(async (address: string) => address === addresses[2] ? [coin] : []);
    const provider = { performRequest, getUtxos } as unknown as NetworkProvider;
    expect(await freshReceiveAddresses(manager, net, provider, 3)).toEqual([addresses[1], addresses[4], addresses[5]]);
    expect(performRequest.mock.calls).toEqual(addresses.map((address) => ['blockchain.scripthash.get_history', scriptHash(address)]));
    expect(getUtxos).toHaveBeenCalledWith(addresses[0]);
  });

  it('uses coins when the supplied provider has no history API', async () => {
    const { manager } = fakeManager();
    const addresses = receiveAddresses(manager, 'mainnet', 4);
    const getUtxos = vi.fn(async (address: string) => address === addresses[0] || address === addresses[2] ? [coin] : []);
    const provider = { getUtxos } as unknown as NetworkProvider;
    expect(await freshReceiveAddresses(manager, 'mainnet', provider, 2)).toEqual([addresses[1], addresses[3]]);
    expect(getUtxos.mock.calls.flat()).toEqual(addresses);
  });

  it('stops at the discovery gap and refuses requests beyond it', async () => {
    const { manager } = fakeManager();
    const getUtxos = vi.fn(async () => []);
    const provider = { getUtxos } as unknown as NetworkProvider;
    expect(await freshReceiveAddresses(manager, 'mainnet', provider, GAP_LIMIT)).toHaveLength(GAP_LIMIT);
    expect(getUtxos).toHaveBeenCalledTimes(GAP_LIMIT);
    getUtxos.mockClear();
    for (const count of [GAP_LIMIT + 1, -1, 0.5, NaN]) {
      await expect(freshReceiveAddresses(manager, 'mainnet', provider, count)).rejects.toThrow('gap limit');
    }
    expect(await freshReceiveAddresses(manager, 'mainnet', provider, 0)).toEqual([]);
    expect(getUtxos).not.toHaveBeenCalled();
  });

  it('does not treat a failed history lookup as an unused address', async () => {
    const { manager } = fakeManager();
    const performRequest = vi.fn(async () => { throw new Error('History unavailable'); });
    const getUtxos = vi.fn(async () => []);
    const provider = { performRequest, getUtxos } as unknown as NetworkProvider;
    await expect(freshReceiveAddresses(manager, 'mainnet', provider, 2)).rejects.toThrow('History unavailable');
    expect(performRequest).toHaveBeenCalledTimes(1);
    expect(getUtxos).not.toHaveBeenCalled();
  });

  it('reports exhaustion of the scan limit instead of returning a partial list', async () => {
    const { manager } = fakeManager();
    const getUtxos = vi.fn(async () => [coin]);
    const provider = { getUtxos } as unknown as NetworkProvider;
    await expect(freshReceiveAddresses(manager, 'mainnet', provider, 2)).rejects.toThrow('scan limit');
    expect(getUtxos).toHaveBeenCalledTimes(MAX_SCAN);
  });
});
