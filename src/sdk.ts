// Allpaid SDK: everything a wallet, a point-of-sale app or a bot needs to work
// with jars, without the web page. Same code the site and the keeper run.
//
//   import { decodeJar, jarAddress, JarEngine } from './sdk';
//   const config = decodeJar(code);              // from a jar link
//   const address = jarAddress(config);          // where to pay
//   await new JarEngine(config, address).once(); // send any waiting split
//
// The contract itself does not check the shares (it pays the last member the
// remainder), so a jar whose shares do not add up to exactly 10,000 basis points
// could lock coins for good. Every function here that makes a contract
// (jarAddress, makeContract, jarTree, resolveJar, JarEngine) throws on such a
// jar, at every level of nesting. sharesProblem() and validateJar() report the
// problem without throwing.
export {
  decodeJar,
  encodeJar,
  validateJar,
  splitPot,
  minPaymentFor,
  walletCount,
  levelCount,
  jarCodeFromLink,
  SPLIT_FEE,
  TOTAL_BPS,
  sharesProblem,
  type JarConfig,
  type Member,
  type SubJar,
  type Net,
} from './lib/jar';
export { jarAddress, jarTree, resolveJar, makeContract, buildDistribute, buildMerge, getProvider, explorerTx } from './lib/chain';
export { JarEngine, type JarEvent, type JarSnapshot } from './lib/engine';
export { payWithWallet, scanWallet } from './lib/wallet';
