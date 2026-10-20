import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
const paths = ['oath.toml','src/main.oath','encoding.json','scenarios/example.json','tests/unimplemented.json','README.md'];
export async function materialize(bundle, destination) {
  if (bundle.format !== 'lawlib-draft-bundle/1' || !bundle.files || Object.keys(bundle.files).length !== paths.length || paths.some(p => typeof bundle.files[p] !== 'string') || Object.values(bundle.files).some(s => typeof s !== 'string' || Buffer.byteLength(s) > 1024 ** 2)) throw new Error('Invalid draft bundle');
  await mkdir(destination); // An existing directory is never overwritten.
  for (const path of paths) {
    const target=join(destination,path); await mkdir(dirname(target),{recursive:true});
    await writeFile(target,bundle.files[path],{flag:'wx'});
  }
}
