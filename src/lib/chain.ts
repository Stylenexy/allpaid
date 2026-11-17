// Everything that touches the chain: providers, the contract, and the three
// transactions the app can build (split, merge, and the cheat that must fail).
import {
  Contract,
  ElectrumNetworkProvider,
  MockNetworkProvider,
  TransactionBuilder,
  type NetworkProvider,
  type SpendableUtxo,
  type Utxo,
} from 'cashscript';
import { binToHex, decodeTransaction, hashTransaction, hexToBin } from '@bitauth/libauth';
import artifact from '../contract/allpaid.artifact';
import { contractArgs, splitPot, subConfig, SPLIT_FEE, type JarConfig, type Member, type Net, lockingBytecodeOf } from './jar';

export type AllpaidContract = Contract<typeof artifact>;

const ELECTRUM_HOSTS: Record<Exclude<Net, 'sandbox'>, string[]> = {
  mainnet: ['bch.imaginary.cash', 'electroncash.de', 'bch.loping.net'],
  chipnet: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'],
};

const providers = new Map<Net, NetworkProvider>();

/** One provider per network for the whole page. The sandbox lives in memory. */
export async function getProvider(net: Net): Promise<NetworkProvider> {
  const existing = providers.get(net);
  if (existing) return existing;
  if (net === 'sandbox') {
    const mock = new MockNetworkProvider();
    providers.set(net, mock);
    return mock;
  }
  let lastError: unknown;
  for (const hostname of ELECTRUM_HOSTS[net]) {
    const provider = new ElectrumNetworkProvider(net, { hostname, manualConnectionManagement: true });
    try {
      await withTimeout(provider.connect(), 6000, `Could not reach ${hostname}`);
      providers.set(net, provider);
      return provider;
    } catch (error) {
      lastError = error;
      provider.disconnect().catch(() => undefined);
    }
  }
  throw new Error(`No Electrum server answered for ${net}. ${errorText(lastError)}`);
}

export function makeContract(config: JarConfig, provider: NetworkProvider): AllpaidContract {
  return new Contract(artifact, contractArgs(resolveJar(config)), { provider, contractType: 'p2sh32' });
}

/** The contract address without needing a network connection. */
export function jarAddress(config: JarConfig): string {
  return makeContract(config, offlineProvider(config.net)).address;
}

/**
 * Fill in the address of every nested jar (its own contract address), deepest
 * first. A nested jar is paid like any other member: to its locking bytecode.
 */
export function resolveJar(config: JarConfig): JarConfig {
  if (!config.members.some((m) => m.jar)) return config;
  const members: Member[] = config.members.map((m) => {
    if (!m.jar) return m;
    const child = resolveJar(subConfig(config, m));
    return { ...m, address: jarAddress(child), jar: { name: child.name, members: child.members } };
  });
  return { ...config, members };
}

/** One jar in a split tree. The root is "0"; its third member's jar is "0.2". */
export interface JarNode {
  id: string;
  config: JarConfig;
  address: string;
  parent?: string;
  /** Position of this jar among its parent's members. */
  slot?: number;
  depth: number;
}

export function jarTree(config: JarConfig): JarNode[] {
  const nodes: JarNode[] = [];
  const walk = (c: JarConfig, id: string, depth: number, parent?: string, slot?: number) => {
    const resolved = resolveJar(c);
    nodes.push({ id, config: resolved, address: jarAddress(resolved), parent, slot, depth });
    resolved.members.forEach((m, i) => {
      if (m.jar) walk(subConfig(resolved, m), `${id}.${i}`, depth + 1, id, i);
    });
  };
  walk(config, '0', 0);
  return nodes;
}

const offline = new Map<Net, NetworkProvider>();
function offlineProvider(net: Net): NetworkProvider {
  // A provider object is only used here for its network name (address prefix).
  const cached = offline.get(net);
  if (cached) return cached;
  const p =
    net === 'sandbox'
      ? new MockNetworkProvider()
      : new ElectrumNetworkProvider(net, { hostname: ELECTRUM_HOSTS[net][0], manualConnectionManagement: true });
  offline.set(net, p);
  return p;
}

export interface BuiltTx {
  hex: string;
  txid: string;
  bytes: number;
}

function finish(hex: string): BuiltTx {
  return { hex, txid: hashTransaction(hexToBin(hex)), bytes: hex.length / 2 };
}

/**
 * The honest split. Fully determined by the coin it spends: every device that
 * builds it gets the same transaction and the same txid.
 */
export function buildDistribute(contract: AllpaidContract, jar: JarConfig, utxo: SpendableUtxo): BuiltTx {
  const config = resolveJar(jar);
  const shares = splitPot(utxo.satoshis, config.members.map((m) => m.bps), SPLIT_FEE);
  const builder = new TransactionBuilder({ provider: contract.provider });
  builder.addInput(utxo, contract.unlock.distribute());
  config.members.forEach((m, i) => builder.addOutput({ to: m.address, amount: shares[i] }));
  return finish(builder.build());
}

/** Join two coins that are each too small to split. They stay in the jar. */
export function buildMerge(contract: AllpaidContract, a: SpendableUtxo, b: SpendableUtxo): BuiltTx {
  const builder = new TransactionBuilder({ provider: contract.provider });
  builder.addInput(a, contract.unlock.merge());
  builder.addInput(b, contract.unlock.merge());
  builder.addOutput({ to: contract.address, amount: a.satoshis + b.satoshis - SPLIT_FEE });
  return finish(builder.build());
}

/**
 * The cheat: same coin, same unlock, but the whole pot goes to member 1
 * (the one who would have held the tin). The network must refuse it.
 */
export function buildCheat(contract: AllpaidContract, config: JarConfig, utxo: SpendableUtxo): BuiltTx {
  const builder = new TransactionBuilder({ provider: contract.provider });
  builder.addInput(utxo, contract.unlock.distribute());
  builder.addOutput({ to: resolveJar(config).members[0].address, amount: utxo.satoshis - SPLIT_FEE });
  return finish(builder.build());
}

/**
 * After the network refuses the cheat, find which contract line refused it,
 * by replaying the same transaction in CashScript's debugger.
 */
export function explainCheat(contract: AllpaidContract, config: JarConfig, utxo: SpendableUtxo): { rule: string; line?: string } | null {
  const builder = new TransactionBuilder({ provider: contract.provider });
  builder.addInput(utxo, contract.unlock.distribute());
  builder.addOutput({ to: resolveJar(config).members[0].address, amount: utxo.satoshis - SPLIT_FEE });
  try {
    builder.debug();
    return null;
  } catch (error) {
    const text = errorText(error);
    const rule = /following message: (.*?)\.?\s*(\n|$)/.exec(text)?.[1];
    const line = /line (\d+)/.exec(text)?.[1];
    return rule ? { rule, line } : { rule: text.split('\n')[0] };
  }
}

/** Broadcast without any local check, so a refusal comes from the network itself. */
export async function broadcast(provider: NetworkProvider, tx: BuiltTx): Promise<string> {
  return provider.sendRawTransaction(tx.hex);
}

/** A rebroadcast of a transaction the network already has is a success, not an error. */
export function isAlreadyKnown(error: unknown): boolean {
  return /already (known|in (the )?mempool|have)|txn-already|transaction already in block chain/i.test(errorText(error));
}

/** Another device split this coin first. The split is deterministic, so the txid is ours too. */
export function isConflict(error: unknown): boolean {
  return /missing ?inputs|txn-mempool-conflict|bad-txns-inputs-missingorspent|inputs-missingorspent/i.test(errorText(error));
}

export function errorText(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Put a fake payment into the in-memory sandbox network. */
export function sandboxPay(provider: NetworkProvider, address: string, satoshis: bigint): Utxo {
  if (!(provider instanceof MockNetworkProvider)) throw new Error('Sandbox only');
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return provider.addUtxo(address, { txid: binToHex(bytes), vout: 0, satoshis });
}

export function explorerTx(net: Net, txid: string): string | null {
  if (net === 'mainnet') return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
  if (net === 'chipnet') return `https://chipnet.imaginary.cash/tx/${txid}`;
  return null;
}

export function explorerAddress(net: Net, address: string): string | null {
  if (net === 'mainnet') return `https://blockchair.com/bitcoin-cash/address/${address.replace('bitcoincash:', '')}`;
  if (net === 'chipnet') return `https://chipnet.imaginary.cash/address/${address}`;
  return null;
}

export function outputsOf(hex: string): { lockingBytecode: string; satoshis: bigint }[] {
  const tx = decodeTransaction(hexToBin(hex));
  if (typeof tx === 'string') return [];
  return tx.outputs.map((o) => ({ lockingBytecode: binToHex(o.lockingBytecode), satoshis: o.valueSatoshis }));
}

export function memberIndexForLock(config: JarConfig, lockHex: string): number {
  return config.members.findIndex((m) => {
    const lock = lockingBytecodeOf(m.address);
    return typeof lock !== 'string' && binToHex(lock) === lockHex;
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
