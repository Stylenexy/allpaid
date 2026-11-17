// Rasterise the Locked Slot mark for browser and wallet icons.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const mark = readFileSync('public/favicon.svg', 'utf8');
const render = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
writeFileSync('public/favicon-32.png', render(mark, 32));
writeFileSync('public/icon-192.png', render(mark, 192));
writeFileSync('public/icon-512.png', render(mark, 512));
console.log('icons written');
