// What the automatic demo does, in order: pay the play-money jar, play the thief
// twice, then make a jar of your own. Each step presses the real controls through
// the Driver, so the split and the refusals on screen are computed by the app and
// the BCH VM. The payoff comes first: seven wallets paid by second ~12, the first
// refusal by second ~30.

import { sampleAddress } from '../lib/sample';
import type { Driver } from './driver';

export const CHAPTERS = { 1: 'Pay it', 2: 'Try to cheat it', 3: 'Make yours' } as const;

export type DemoStep = {
  chapter: keyof typeof CHAPTERS;
  title: string;
  text: string;
  run: (d: Driver) => Promise<void>;
};

/** Members for the make-yours part. Chipnet sample addresses: valid, and nobody holds their keys. Shares stay even. */
const MEMBERS = ['Vocals', 'Drums', 'Sound'];

const splitCount = () => document.querySelectorAll('.activity .act-split').length;

/** "Refused at line 32", read from the stamp the page drew. */
function stampLabel() {
  const line = document.querySelector('.v3a-stamp span')?.textContent?.trim();
  return line ? `Refused at ${line}` : 'Refused';
}

async function thiefTries(d: Driver) {
  await d.press('.cheat-row .v3-pill', 'Let the thief try');
  const seen = await d.until(() => !!document.querySelector('.v3a-receipt .v3a-stamp'), 20_000);
  if (!seen) throw new Error('No refusal came back');
  await d.wait(400);
  await d.look('.v3a-receipt .v3a-stamp', stampLabel, 1900, 0.9, 0.86);
}

export const STEPS: DemoStep[] = [
  {
    chapter: 1,
    title: "A street band's jar",
    text: 'Four members, and one of them is a jar of its own. Type an amount: before anything is paid, the page shows where every satoshi goes.',
    run: async (d) => {
      await d.go('/try');
      await d.type('#pay-amount', '0.001', 'Type 0.001 BCH', 110);
      await d.look('.v3a-flow', 'Where it goes', 2200, 0.25, 0.5);
    },
  },
  {
    chapter: 1,
    title: 'Pay once',
    text: 'Play money, on a network that lives in this tab. The split is still built by the real contract and checked by the Bitcoin Cash VM.',
    run: async (d) => {
      const before = splitCount();
      await d.press('.pay-sandbox .v3-pill', 'Pay 0.001 BCH');
      const split = await d.until(() => splitCount() >= before + 2, 25_000);
      if (!split) throw new Error('The split did not arrive');
    },
  },
  {
    chapter: 1,
    title: 'Seven wallets paid',
    text: "Seconds later the jar pays every member. The road crew's share lands in its own jar, and that jar splits again.",
    run: async (d) => {
      await d.look('[data-demo="tree"]', 'Seven wallets paid', 2800, 0.45, 0.4);
    },
  },
  {
    chapter: 1,
    title: 'One transaction per split',
    text: 'Each split is a single transaction, sent milliseconds after the payment landed.',
    run: async (d) => {
      await d.look('[data-demo="activity"]', 'What happened', 2200, 0.5, 0.3);
    },
  },
  {
    chapter: 2,
    title: 'Play the thief',
    text: "Anyone may send a jar's split, so a thief can try to send it wrong. First try: the whole payment to one member.",
    run: async (d) => {
      await d.press('.pay-next', 'Now try to cheat it');
      await d.wait(600);
      await d.look('.v3a-receipt', "The thief's version", 2300, 0.6, 0.45);
    },
  },
  {
    chapter: 2,
    title: 'Refused',
    text: "The thief's transaction goes to the VM with no check from us. The contract refuses it at the line shown, then the honest split runs.",
    run: async (d) => {
      await thiefTries(d);
      await d.look('.refusal-code', 'The rule that caught it', 2300, 0.35, 0.5);
    },
  },
  {
    chapter: 2,
    title: 'A smarter thief',
    text: 'Every member is paid and the total adds up, but two members trade amounts. Refused again, by a different line.',
    run: async (d) => {
      await d.press('.cheat-choice .seg-btn:nth-child(2)', 'Swap two amounts');
      await thiefTries(d);
    },
  },
  {
    chapter: 3,
    title: 'Now make yours',
    text: 'Name the group. This run uses chipnet test coins, so nothing on screen can cost anyone money.',
    run: async (d) => {
      await d.go('/new');
      await d.type('#jar-name', 'Malioboro Night Band', 'Type the group name', 34);
      await d.press('.net-toggle .seg-btn:nth-child(2)', 'Choose chipnet');
      // Never fill a mainnet form with sample addresses: stop if chipnet did not take.
      const chipnet = await d.until(() => document.querySelector('.net-toggle .seg-btn:nth-child(2)')?.getAttribute('aria-checked') === 'true', 2000);
      if (!chipnet) throw new Error('Chipnet was not selected');
    },
  },
  {
    chapter: 3,
    title: 'Add the members',
    text: 'A name and a payout address for each member. The shares start even, and any of them can change.',
    run: async (d) => {
      for (const [i, name] of MEMBERS.entries()) {
        await d.type(`#m${i}-name`, name, 'Type a name', 34);
        await d.paste(`#m${i}-addr`, sampleAddress(`demo ${name.toLowerCase()}`, 'bchtest'), 'Paste their address');
      }
    },
  },
  {
    chapter: 3,
    title: 'The split becomes the address',
    text: "Names, addresses and shares become the jar's own address, computed in this browser. There is no owner key: change one share and you get a different jar.",
    run: async (d) => {
      await d.look('.v3a-preview', "Your jar's QR", 3000, 0.3, 0.45);
    },
  },
];
