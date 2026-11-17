// Names and shares of the sample band, without payout addresses: enough for the
// landing page text without loading the Bitcoin Cash libraries. sample.ts adds
// the addresses for the sandbox.

export interface SampleMember {
  name: string;
  bps: number;
  jar?: { name: string; members: SampleMember[] };
}

/**
 * A street band whose fourth share goes to its road crew's own jar.
 * One payment, two levels, seven wallets.
 */
export const SAMPLE_SHAPE: { name: string; members: SampleMember[] } = {
  name: 'Malioboro Night Band',
  members: [
    { name: 'Vocals', bps: 3000 },
    { name: 'Drums', bps: 2500 },
    { name: 'Sound', bps: 2000 },
    {
      name: 'Road crew',
      bps: 2500,
      jar: {
        name: 'Road crew',
        members: [
          { name: 'Manager', bps: 4000 },
          { name: 'Stage', bps: 2500 },
          { name: 'Driver', bps: 2000 },
          { name: 'Photos', bps: 1500 },
        ],
      },
    },
  ],
};
