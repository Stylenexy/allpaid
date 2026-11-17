# Chipnet proof

**Status: waiting for test coins.** No chipnet transaction has been sent yet. This page is replaced by the real run's report (transaction ids, explorer links, node refusals, keeper output) as soon as `npm run chipnet -- run` completes.

## What the run proves

Chipnet is a public Bitcoin Cash test network: real nodes, test coins. [`scripts/chipnet-proof.ts`](../scripts/chipnet-proof.ts) does, in order:

1. **Pay** 60,000 sats from a plain P2PKH test wallet into a jar shaped like the sample band (Vocals 30%, Drums 25%, Sound 20%, and a Road crew jar of four at 25%).
2. **Cheat 1**, before the honest split: a spend of the same coin that sends everything to Vocals, broadcast straight to the node. Expected refusal: `Allpaid.cash` line 32, *one output per member, no extra outputs*.
3. **Distribute** (band jar pays three wallets and the crew jar) and **nested distribute** (the crew jar splits again).
4. **Pay again** and **cheat 2**: every member paid, right total, Vocals' and Drums' amounts swapped. Expected refusal: line 39, *output 0 has the wrong amount*. Then the honest split and the nested split.
5. **Pay a third time with no page open**, then one keeper round: `npm run keeper -- "<jar link>"` sends the split and the nested split.
6. Check that the seven wallets hold three payments minus six split fees.

## Funding address

`bchtest:qrky5zvnsu3wxl4jnyeh4qgez48zz8pdnu68qeul5z` ([explorer](https://chipnet.imaginary.cash/address/bchtest:qrky5zvnsu3wxl4jnyeh4qgez48zz8pdnu68qeul5z))

The run needs about 0.00183 tBCH; one faucet drip is enough. The key is in `.env.chipnet.local` on the author's machine, ignored by git and by Vercel. Every wallet in the proof jar is derived from it, so the coins only move between test addresses made for this run.

The public chipnet faucets ([tbch.googol.cash](https://tbch.googol.cash), [faucet.paytaca.com](https://faucet.paytaca.com)) ask for a CAPTCHA, so a person requests the coins. Nothing here tries to get past one.

## Dry run (in-memory network, not chipnet)

`npm run chipnet -- run --dry` runs the same steps against CashScript's in-memory network, where the Bitcoin Cash VM (libauth) checks every transaction. Result on 17 November 2026:

- Three payments, four honest splits (two levels each), one keeper round with two splits.
- Cheat 1 refused: rule *one output per member, no extra outputs*, line 32.
- Cheat 2 refused: rule *output 0 has the wrong amount*, line 39.
- The seven wallets held 174,000 sats: 3 × 60,000 minus 6 × 1,000.

This shows the script works. It is not the chipnet proof: that needs a real node to judge the transactions.
