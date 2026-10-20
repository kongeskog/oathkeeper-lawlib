import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import { loadUnit, loadCatalog, checkedGzip } from './extract-provisions.mjs';
import { renderDraft } from './draft.mjs';
import { impact } from './impact.mjs';
import { materialize } from './materialize.mjs';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'show' && args.length === 3) console.log(JSON.stringify(await loadUnit(...args), null, 2));
  else if (command === 'scaffold' && args.length === 5) {
    const [root, file, key, configPath, destination] = args;
    const selected = await loadUnit(root, file, key);
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const files = renderDraft(selected, config);
    await mkdir(destination);
    for (const [path, text] of Object.entries(files)) {
      const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text, { flag: 'wx' });
    }
    console.log(`Created unimplemented draft at ${resolve(destination)}; run oath lock, check and test explicitly.`);
  } else if (command === 'materialize' && args.length === 2) {
    const raw = await readFile(args[0]);
    if(raw.length > 6 * 1024 ** 2) throw new Error('Draft bundle exceeds reader limit');
    await materialize(JSON.parse(raw.toString('utf8')), args[1]);
    console.log('Draft written; inspect the files, then explicitly lock, check and test.');
  } else if (command === 'impact' && args.length === 4) {
    const [before, after, registryPath, output] = args;
    const report = await impact(before, after, JSON.parse(await readFile(registryPath, 'utf8')));
    await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(`${report.changes.length} source changes; ${report.affected.length} registered encodings to reassess`);
  } else if (command === 'validate-links' && args.length === 3) {
    const [root, registryPath, lawlibRoot] = args;
    const { validateRegistry } = await import('./impact.mjs');
    const registry = JSON.parse(await readFile(registryPath, 'utf8')); validateRegistry(registry);
    const catalog = await loadCatalog(root);
    for (const e of registry.encodings) {
      const path = resolve(lawlibRoot, e.package), rel = relative(resolve(lawlibRoot), path);
      if (rel.startsWith('..') || rel.includes(':')) throw new Error('Package escapes lawlib');
      for (const t of e.tests) {
        const testPath = resolve(path, t), testRel = relative(path, testPath);
        if (testRel.startsWith('..') || testRel.includes(':')) throw new Error('Test path escapes package');
        const fixture = JSON.parse(await readFile(testPath, 'utf8'));
        if (fixture.request.query !== e.query) throw new Error(`Fixture/query mismatch: ${e.id}`);
      }
      for (const s of e.sources.filter(s => s.release === catalog.source.release)) {
        const { unit } = await loadUnit(root, s.file, s.key ?? s.locator);
        if (unit.content_sha256 !== s.content_sha256) throw new Error(`Stale source binding: ${e.id}`);
      }
    }
    console.log('Registry structure, selected snapshot bindings and fixture query names checked; run oath check/test for compiler validation. Other source snapshots were not checked.');
  } else throw new Error('Commands: show ROOT FILE LOCATOR_OR_KEY | scaffold ROOT FILE KEY CONFIG NEW_DIRECTORY | impact BEFORE_ROOT AFTER_ROOT REGISTRY NEW_REPORT | validate-links ROOT REGISTRY LAWLIB');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
