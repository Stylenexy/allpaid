// Paying into a jar from a wallet connected with WizardConnect.
// The wallet shares its extended public keys; we derive its addresses, find its
// coins, build the payment, and ask the wallet to sign it. Keys never leave the wallet.
import { TransactionBuilder, placeholderP2PKHUnlocker, type NetworkProvider, type SpendableUtxo } from 'cashscript';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import { sourceOutputToRelay, transactionToHex } from '@wizardconnect/core/hdwalletv1-serialize';
import { binToHex, cashAddressToLockingBytecode, encodeCashAddress, hash160, hashTransaction, hexToBin, sha256 } from '@bitauth/libauth';
import { prefixFor, type Net } from './jar';
import { errorText, isAlreadyKnown } from './chain';

const PATHS = [
  { child: 0, name: 'receive' },
  { child: 1, name: 'change' },
] as const;
/** Standard wallet gap limit: the scan of a path stops after this many unused addresses in a row. */
export const GAP_LIMIT = 20;
/** Never look past this many addresses per path, however long the history. */
export const MAX_SCAN = 100;
/** Fee rate for the payment, in sats per byte. The relay minimum is 1. */
const FEE_RATE = 1.2;

export interface WalletCoin extends SpendableUtxo {
  address: string;
  path: 'receive' | 'change';
  index: number;
}

export interface WalletScan {
  coins: WalletCoin[];
  balance: bigint;
  changeAddress: string;
}

function addressFor(manager: DappConnectionManager, child: number, index: number, net: Net): string | null {
  const pubkey = manager.getPubkey(child, BigInt(index));
  if (!pubkey) return null;
  return encodeCashAddress({ prefix: prefixFor(net), type: 'p2pkh', payload: hash160(pubkey) }).address;
}

/** Derive receive addresses from the wallet's shared public keys, without network access. */
export function receiveAddresses(manager: DappConnectionManager, net: Net, count: number, start = 0): string[] {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(start + count)) {
    throw new Error('The address count and starting index must be non-negative integers.');
  }
  return Array.from({ length: count }, (_, offset) => {
    const address = addressFor(manager, 0, start + offset, net);
    if (!address) throw new Error('The wallet did not share receive public keys. Try pairing again.');
    return address;
  });
}

type HistoryProvider = NetworkProvider & {
  performRequest(name: string, ...parameters: (string | number | boolean)[]): Promise<unknown>;
};

const hasHistory = (provider: NetworkProvider): provider is HistoryProvider =>
  typeof (provider as Partial<HistoryProvider>).performRequest === 'function';

/**
 * Has this address ever been used, and what can it spend now? An Electrum
 * server answers from the address history, so an address that was emptied
 * still counts as used. Other providers (the in-memory one) fall back to coins.
 */
async function probe(provider: NetworkProvider, address: string): Promise<{ used: boolean; coins: SpendableUtxo[] }> {
  if (hasHistory(provider)) {
    const lock = cashAddressToLockingBytecode(address);
    if (typeof lock === 'string') return { used: false, coins: [] };
    const scripthash = binToHex(Uint8Array.from(sha256.hash(lock.bytecode)).reverse());
    const history = await provider.performRequest('blockchain.scripthash.get_history', scripthash);
    if (!Array.isArray(history) || history.length === 0) return { used: false, coins: [] };
    return { used: true, coins: await provider.getUtxos(address) };
  }
  const coins = await provider.getUtxos(address);
  return { used: coins.length > 0, coins };
}

/** Find unused receive addresses inside the wallet's discovery gap. Provider errors are not evidence of freshness. */
export async function freshReceiveAddresses(manager: DappConnectionManager, net: Net, provider: NetworkProvider, count: number): Promise<string[]> {
  if (!Number.isSafeInteger(count) || count < 0 || count > GAP_LIMIT) {
    throw new Error(`Request between 0 and ${GAP_LIMIT} receive addresses to stay within the wallet's gap limit.`);
  }
  const addresses: string[] = [];
  let unused = 0;
  for (let index = 0; index < MAX_SCAN && unused < GAP_LIMIT && addresses.length < count; index += 1) {
    const [address] = receiveAddresses(manager, net, 1, index);
    const { used } = await probe(provider, address);
    unused = used ? 0 : unused + 1;
    if (!used) addresses.push(address);
  }
  if (addresses.length !== count) throw new Error('Could not find enough unused receive addresses within the wallet scan limit.');
  return addresses;
}

/** Walk one path (receive or change) until GAP_LIMIT unused addresses in a row, or MAX_SCAN. */
async function scanPath(manager: DappConnectionManager, path: (typeof PATHS)[number], net: Net, provider: NetworkProvider): Promise<WalletCoin[]> {
  const found: WalletCoin[] = [];
  let lastUsed = -1;
  let next = 0;
  while (next < MAX_SCAN && next <= lastUsed + GAP_LIMIT) {
    const end = Math.min(MAX_SCAN, lastUsed + GAP_LIMIT + 1);
    const batch: Promise<void>[] = [];
    for (let index = next; index < end; index += 1) {
      const address = addressFor(manager, path.child, index, net);
      if (!address) continue;
      batch.push(
        probe(provider, address)
          .catch(() => ({ used: false, coins: [] as SpendableUtxo[] }))
          .then(({ used, coins }) => {
            if (used && index > lastUsed) lastUsed = index;
            for (const u of coins) if (!u.token) found.push({ ...u, address, path: path.name, index });
          }),
      );
    }
    await Promise.all(batch);
    next = end;
  }
  return found.sort((a, b) => a.index - b.index);
}

export async function scanWallet(manager: DappConnectionManager, net: Net, provider: NetworkProvider): Promise<WalletScan> {
  const coins = (await Promise.all(PATHS.map((path) => scanPath(manager, path, net, provider)))).flat();
  const changeAddress = addressFor(manager, 1, 0, net) ?? addressFor(manager, 0, 0, net);
  if (!changeAddress) throw new Error('The wallet did not share any addresses.');
  return { coins, balance: coins.reduce((s, c) => s + c.satoshis, 0n), changeAddress };
}

/**
 * Build the payment, have the wallet sign it over WizardConnect, broadcast it.
 * Returns the payment txid.
 */
export async function payWithWallet(opts: {
  manager: DappConnectionManager;
  provider: NetworkProvider;
  scan: WalletScan;
  jarAddress: string;
  amount: bigint;
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { manager, provider, scan, jarAddress, amount, prompt } = opts;
  // Largest coins first keeps the transaction small.
  const sorted = [...scan.coins].sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const chosen: WalletCoin[] = [];
  let total = 0n;
  for (const coin of sorted) {
    chosen.push(coin);
    total += coin.satoshis;
    const estimate = BigInt(Math.ceil((10 + chosen.length * 148 + 2 * 44) * FEE_RATE));
    if (total >= amount + estimate) break;
  }
  const builder = new TransactionBuilder({ provider });
  for (const coin of chosen) builder.addInput(coin, placeholderP2PKHUnlocker(coin.address));
  builder.addOutput({ to: jarAddress, amount });
  try {
    builder.addBchChangeOutputIfNeeded({ to: scan.changeAddress, feeRate: FEE_RATE });
  } catch {
    throw new Error('Not enough BCH found in this wallet for that amount plus the network fee. Lower the amount, or scan the QR with this wallet.');
  }
  const wc = builder.generateWcTransactionObject({ broadcast: false, userPrompt: prompt });
  const relayRequest = {
    transaction: transactionToHex(wc.transaction.inputs, wc.transaction.outputs, wc.transaction.version, wc.transaction.locktime),
    sourceOutputs: wc.sourceOutputs.map((so) => sourceOutputToRelay(so)),
    broadcast: false,
    userPrompt: prompt,
  };
  const inputPaths = chosen.map((coin, i) => [i, coin.path, coin.index] as [number, string, number]);
  const response = await manager.signTransaction(
    { transaction: relayRequest as never, inputPaths },
    { signal: opts.signal },
  );
  if (response.error) throw new Error(`The wallet said: ${response.error}`);
  if (!response.signedTransaction) throw new Error('The wallet returned no signed transaction.');
  try {
    return await provider.sendRawTransaction(response.signedTransaction);
  } catch (error) {
    if (isAlreadyKnown(error)) return hashTransaction(hexToBin(response.signedTransaction));
    throw new Error(`The network refused the payment: ${errorText(error)}`);
  }
}
