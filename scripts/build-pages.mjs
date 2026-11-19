import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, '_site');
// Only this repository's generated build folder is replaced.
rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
cpSync(path.join(root, 'public'), out, {recursive: true, filter: src => !src.endsWith('.DS_Store')});
writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built Global Sand Watch into _site/.');
