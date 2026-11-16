// Rasterise the hand-drawn tin mark into PNG icons (favicon fallback, app icon, WizardConnect dapp icon).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const mark = readFileSync('public/favicon.svg', 'utf8');
// App icon: the mark on the night background with breathing room.
const onNight = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" rx="14" fill="#0B1018"/>
  <g transform="translate(6 5) scale(0.82)">${mark.replace(/<\/?svg[^>]*>/g, '')}</g>
</svg>`;
const render = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
writeFileSync('public/favicon-32.png', render(mark, 32));
writeFileSync('public/icon-192.png', render(onNight(192), 192));
writeFileSync('public/icon-512.png', render(onNight(512), 512));
console.log('icons written');
