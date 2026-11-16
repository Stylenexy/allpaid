// Compile contracts/Splitjar.cash into a typed artifact the app and the tests import.
import { compileFile } from 'cashc';
import { utils } from 'cashc';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'contracts', 'Splitjar.cash');
const outDir = join(root, 'src', 'contract');

const artifact = compileFile(source);
// A fixed timestamp keeps the artifact byte-identical between builds.
artifact.updatedAt = '2026-11-17T00:00:00.000Z';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'splitjar.artifact.ts'), utils.formatArtifact(artifact, 'ts'));
console.log(`compiled ${artifact.contractName}: ${artifact.bytecode.split(' ').length} ops, compiler ${artifact.compiler.version}`);
