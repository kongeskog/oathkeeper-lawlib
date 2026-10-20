import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root, validate, render } from './build.mjs';
import { authorityLinks, historicalLinks } from './structure.mjs';
const data = JSON.parse(await readFile(join(root, 'inventory/constitution/provisions.json'), 'utf8'));
test('all original clauses and every amendment have stable, distinct inventory entries', () => {
  validate(data);
  assert.equal(data.provisions.length, 137);
  assert.equal(data.provisions.filter(p => p.unit === 'Preamble').length, 1);
  const p = id => data.provisions.find(p => p.id === id);
  assert.match(p('us.const.article.1.s7.c2').text, /Sundays excepted/);
  assert.match(p('us.const.amendment.23.s1').text, /A number of electors/); // two source paragraphs, one section
  assert.match(p('us.const.amendment.27').text, /^No law, varying/);
  assert.ok(!data.provisions.some(p => /Article the first/.test(p.text))); // unratified proposal is not Amendment I
  assert.equal(p('us.const.amendment.20.s5').analysis, 'ExecutableSubset');
  assert.equal(p('us.const.article.6.c2').analysis, 'InterpretationRequired');
  assert.equal(p('us.const.amendment.2').analysis, 'Represented');
});
test('typed Oath inventory and authority records match the published data exactly', async () => {
  for (const [name, content] of Object.entries(render(data))) assert.equal(await readFile(join(root, 'us/federal/constitution/src', name), 'utf8'), content);
  assert.deepEqual(data.relationships.map(r => [r.from, r.to, r.kind, r.scope]), [...authorityLinks, ...historicalLinks]);
});
test('source alterations and dangling authority endpoints are rejected', () => {
  const badText = structuredClone(data); badText.provisions[0].text += ' Changed';
  assert.throws(() => validate(badText));
  const badSource = structuredClone(data); badSource.source_pins[0].sha256 = '0'.repeat(64);
  assert.throws(() => validate(badSource));
  const badLink = structuredClone(data); badLink.relationships[0].to = 'invented.actor';
  assert.throws(() => validate(badLink));
});
test('historical repeal preserves text and partial amendment links do not erase clauses', () => {
  assert.equal(data.relationships.filter(r => r.kind === 'Repeals').length, 3);
  assert.ok(data.provisions.find(p => p.id === 'us.const.amendment.18.s1').text.startsWith('After one year'));
  assert.ok(data.provisions.find(p => p.id === 'us.const.article.1.s2.c3').text.includes('three fifths'));
  assert.ok(data.relationships.find(r => r.to === 'us.const.article.1.s2.c3').scope.includes('does not repeal'));
  assert.ok(!data.provisions.some(p => 'valid' in p || 'current' in p));
});
test('every executable link resolves to a real query with authored scenario coverage', async () => {
  const dir = join(root, 'us/federal/constitution');
  const queries = new Set();
  for (const f of await readdir(join(dir, 'src'))) {
    const source = await readFile(join(dir, 'src', f), 'utf8');
    const module = source.match(/^module ([\w.]+);/m)?.[1];
    for (const m of source.matchAll(/^query (\w+)/gm)) queries.add(module + '.' + m[1]);
  }
  const fixtures = await Promise.all((await readdir(join(dir, 'tests'))).map(async f => JSON.parse(await readFile(join(dir, 'tests', f), 'utf8'))));
  for (const query of new Set(data.provisions.flatMap(p => p.executable_queries))) {
    assert.ok(queries.has(query), query);
    assert.ok(fixtures.some(f => f.request.query === query), `Missing fixture: ${query}`);
  }
});
