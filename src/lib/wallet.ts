// Paying into a jar from a wallet connected with WizardConnect.
// The wallet shares its extended public keys; we derive its addresses, find its
// coins, build the payment, and ask the wallet to sign it. Keys never leave the wallet.
import { TransactionBuilder, placeholderP2PKHUnlocker, type NetworkProvider, type SpendableUtxo } from 'cashscript';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import { sourceOutputToRelay, transactionToHex } from '@wizardconnect/core/hdwalletv1-serialize';
import { encodeCashAddress, hash160, hashTransaction, hexToBin } from '@bitauth/libauth';
import { prefixFor, type Net } from './jar';
import { errorText, isAlreadyKnown } from './chain';

const PATHS = [
  { child: 0, name: 'receive' },
  { child: 1, name: 'change' },
] as const;
/** Addresses checked per path. Wallets that use more than this rarely do on a phone. */
const SCAN_DEPTH = 12;
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

export async function scanWallet(manager: DappConnectionManager, net: Net, provider: NetworkProvider): Promise<WalletScan> {
  const lookups: Promise<WalletCoin[]>[] = [];
  for (const path of PATHS) {
    for (let index = 0; index < SCAN_DEPTH; index += 1) {
      const address = addressFor(manager, path.child, index, net);
      if (!address) continue;
      lookups.push(
        provider
          .getUtxos(address)
          .then((utxos) => utxos.filter((u) => !u.token).map((u) => ({ ...u, address, path: path.name, index })))
          .catch(() => []),
      );
    }
  }
  const coins = (await Promise.all(lookups)).flat();
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
    throw new Error('Not enough BCH in this wallet for that amount plus the network fee.');
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
