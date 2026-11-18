// What the automatic demo does, in order: make a jar, pay the play-money jar, then
// play the thief twice. Each step presses the real controls through the Driver, so
// the split and the refusals on screen are computed by the app and the BCH VM.

import { sampleAddress } from '../lib/sample';
import type { Driver } from './driver';

export const CHAPTERS = { 1: 'Make a jar', 2: 'Pay it', 3: 'Try to cheat it' } as const;

export type DemoStep = {
  chapter: keyof typeof CHAPTERS;
  title: string;
  text: string;
  run: (d: Driver) => Promise<void>;
};

/** The band's members for the make-a-jar part. Chipnet sample addresses: valid, and nobody holds their keys. */
const MEMBERS = [
  { name: 'Vocals', pct: '40' },
  { name: 'Drums', pct: '35' },
  { name: 'Sound', pct: '25' },
];

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
  await d.wait(500);
  await d.look('.v3a-receipt .v3a-stamp', stampLabel, 2000, 0.9, 0.86);
}

export const STEPS: DemoStep[] = [
  {
    chapter: 1,
    title: 'Name the group',
    text: 'A street band wants one QR code that pays every member. Making its jar starts with a name.',
    run: async (d) => {
      await d.go('/new');
      await d.type('#jar-name', 'Malioboro Night Band', 'Type the group name', 40);
    },
  },
  {
    chapter: 1,
    title: 'Test coins for this run',
    text: 'Mainnet jars move real BCH. This run uses chipnet test coins, so nothing on screen can cost anyone money.',
    run: async (d) => {
      await d.press('.net-toggle .seg-btn:nth-child(2)', 'Choose chipnet');
    },
  },
  {
    chapter: 1,
    title: 'Add the members',
    text: 'Each member gets a name, a payout address and a share. The addresses in this run are samples whose keys nobody holds.',
    run: async (d) => {
      for (const [i, m] of MEMBERS.entries()) {
        await d.type(`#m${i}-name`, m.name, 'Type a name', 42);
        await d.paste(`#m${i}-addr`, sampleAddress(`demo ${m.name.toLowerCase()}`, 'bchtest'), 'Paste their address');
        await d.type(`#m${i}-pct`, m.pct, 'Set their share', 90);
      }
    },
  },
  {
    chapter: 1,
    title: 'The split becomes the address',
    text: "Names, addresses and shares are turned into the jar's own address, right in this browser. No server keeps the split, and nobody can change it later.",
    run: async (d) => {
      await d.look('.v3a-preview', "The jar's QR", 3200, 0.3, 0.45);
    },
  },
  {
    chapter: 1,
    title: 'Open it, share the QR',
    text: 'Opening the jar gives a page with this QR for whoever pays the band. To pay without real money, this run moves to the play-money jar.',
    run: async (d) => {
      await d.look('.create-actions button[type="submit"]', 'Open the jar', 2200);
      await d.go('/try');
    },
  },
  {
    chapter: 2,
    title: 'The play-money jar',
    text: 'The same band, plus a road crew with a jar of its own. One payment here reaches seven wallets.',
    run: async (d) => {
      await d.wait(600);
      await d.look('.v3a-meta .jar-sub', 'Four members, one is a jar', 2600);
    },
  },
  {
    chapter: 2,
    title: 'Type an amount',
    text: 'Type how much to pay. Before anything is paid, the page lists where every satoshi will go.',
    run: async (d) => {
      await d.type('#pay-amount', '0.01', 'Type 0.01 BCH', 120);
      await d.look('.v3a-flow', 'Where it goes', 2800, 0.25, 0.5);
    },
  },
  {
    chapter: 2,
    title: 'Pay',
    text: 'Play money, on a network that lives in this tab. The split is still built by the real contract and checked by the Bitcoin Cash VM.',
    run: async (d) => {
      const before = splitCount();
      await d.press('.pay-sandbox .v3-pill', 'Pay 0.01 BCH');
      const split = await d.until(() => splitCount() >= before + 2, 25_000);
      if (!split) throw new Error('The split did not arrive');
    },
  },
  {
    chapter: 2,
    title: 'Everyone is paid',
    text: "Seconds later the jar splits the payment. The road crew's share lands in its own jar, and that jar splits again.",
    run: async (d) => {
      await d.look('[data-demo="tree"]', 'Seven wallets paid', 3200, 0.45, 0.4);
    },
  },
  {
    chapter: 2,
    title: 'One transaction per split',
    text: 'The log lists each split as one transaction, with how long after the payment it ran.',
    run: async (d) => {
      await d.look('[data-demo="activity"]', 'What happened', 2800, 0.5, 0.3);
    },
  },
  {
    chapter: 3,
    title: 'Play the thief',
    text: "Anyone may send a jar's split, so a thief can try to send it wrong. First try: the whole payment to one member.",
    run: async (d) => {
      await d.press('.pay-next', 'Now try to cheat it');
      await d.wait(700);
      await d.look('.v3a-receipt', "The thief's version", 2800, 0.6, 0.45);
    },
  },
  {
    chapter: 3,
    title: 'Refused',
    text: "The thief's transaction goes to the VM with no check from us. The contract refuses it, then the honest split runs.",
    run: async (d) => {
      await thiefTries(d);
      await d.look('.refusal-code', 'The rule that caught it', 2800, 0.35, 0.5);
    },
  },
  {
    chapter: 3,
    title: 'A smarter thief',
    text: 'Now every member is paid and the total adds up, but two members trade amounts.',
    run: async (d) => {
      await d.press('.cheat-choice .seg-btn:nth-child(2)', 'Swap two amounts');
      await thiefTries(d);
    },
  },
  {
    chapter: 3,
    title: 'No owner key',
    text: 'Nobody can change the shares later, not even whoever made the jar. Change one share and you get a different address.',
    run: async (d) => {
      await d.look('.v3a-terms .v3a-term:last-child', 'Zero owner keys', 3000, 0.3, 0.4);
    },
  },
];
