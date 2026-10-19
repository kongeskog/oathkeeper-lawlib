import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndexer, USLM } from './uslm.mjs';
import { checkPin, checkEntry, importArchive } from './import-usc.mjs';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wrap = text => `<uscDoc xmlns="${USLM}" identifier="/us/usc/t1"><meta><docPublicationName>Online@119-121</docPublicationName></meta><main>${text}</main></uscDoc>`;
const parse = (xml, limits, chunks = 17) => {
  const rows = []; const index = createIndexer('usc01.xml', row => rows.push(row), limits);
  for (let i = 0; i < xml.length; i += chunks) index.write(xml.slice(i, i + chunks));
  return { summary: index.finish(), rows };
};
test('retains publisher hierarchy, IDs, notes, source credits and unresolved references', () => {
  const xml = wrap('<title identifier="/us/usc/t1"><num>Title 1</num><heading>A &amp; B</heading><section identifier="/us/usc/t1/s1" id="edition-only"><num>§ 1.</num><heading>Rule</heading><sourceCredit><ref href="/us/act/2020-01-01/ch1">An act</ref></sourceCredit><notes><note role="crossHeading" topic="statutoryNotes"><heading>Statutory Notes</heading></note><note topic="effectiveDate"><heading>Commencement</heading></note><note role="crossHeading" topic="editorialNotes"/><note topic="amendments"/></notes></section></title>');
  const { rows, summary } = parse(xml);
  assert.equal(summary.heading, 'A & B');
  assert.equal(summary.counts.section, 1);
  const section = rows.find(r => r.kind === 'section');
  assert.equal(section.attributes.id, 'edition-only');
  const ref = rows.find(r => r.kind === 'ref');
  assert.equal(ref.text, 'An act');
  assert.equal(ref.attributes.href, '/us/act/2020-01-01/ch1');
  assert.equal(rows.find(r => r.node === ref.parent).kind, 'sourceCredit');
  assert.equal(rows.find(r => r.attributes.topic === 'effectiveDate').source_note_group, 'statutoryNotes');
  assert.equal(rows.find(r => r.attributes.topic === 'amendments').source_note_group, 'editorialNotes');
  assert.deepEqual(parse(xml, {}, 1), parse(xml, {}, xml.length));
});
test('repeated locators preserve occurrences rather than silently merging legal identities', () => {
  const { rows } = parse(wrap('<section identifier="/same"/><section identifier="/same"/>'));
  const sections = rows.filter(r => r.kind === 'section');
  assert.equal(sections.length, 2); assert.notEqual(sections[0].node, sections[1].node);
});
test('document headings are not replaced by titles quoted inside provisions', () => {
  const { summary } = parse(wrap('<title identifier="/us/usc/t1"><heading>OUTER</heading><section><title identifier="/quoted"><heading>QUOTED</heading></title></section></title>'));
  assert.equal(summary.heading, 'OUTER');
  const appendix = `<uscDoc xmlns="${USLM}" xmlns:dc="http://purl.org/dc/elements/1.1/"><meta><dc:title>Title 28 Appendix</dc:title></meta><appendix identifier="/us/usc/t28a"><num>28a</num><heading>APPENDIX</heading></appendix></uscDoc>`;
  assert.equal(parse(appendix).summary.document_title, 'Title 28 Appendix');
  assert.equal(parse(appendix).summary.heading, 'APPENDIX');
});
test('rejects malformed XML, entities, wrong namespaces and bounded resource excess', () => {
  for (const xml of [wrap('<section></paragraph>'), wrap('<section id="x" id="y"/>'), wrap('&unresolved;'), '<uscDoc/>', '<!DOCTYPE uscDoc SYSTEM "https://example.invalid/x">' + wrap('')]) assert.throws(() => parse(xml));
  assert.throws(() => parse(wrap('<a><b/></a>'), { depth: 3 }), /depth/);
  assert.throws(() => parse(wrap('<section/>'), { elements: 2 }), /Element/);
  assert.throws(() => parse(wrap('<heading>too long</heading>'), { label: 3 }), /Label/);
});
test('ZIP entries cannot escape the cache, collide with non-XML paths or exceed bounds', () => {
  for (const fileName of ['../usc01.xml', '/usc01.xml', 'dir/usc01.xml', 'usc01.xml.exe']) assert.throws(() => checkEntry({ fileName, uncompressedSize: 1 }));
  assert.throws(() => checkEntry({ fileName: 'usc01.xml', uncompressedSize: 2 ** 30 }));
  checkEntry({ fileName: 'usc28A.xml', uncompressedSize: 1 });
});
test('source integrity is verified before creating an output inventory', async () => {
  const pin = JSON.parse(await readFile(new URL('../../inventory/usc/119-121/source.json', import.meta.url)));
  checkPin(pin);
  assert.throws(() => checkPin({ ...pin, url: 'http://uscode.house.gov/file' }));
  const temp = await mkdtemp(join(tmpdir(), 'lawlib-inventory-'));
  try {
    const bad = join(temp, 'bad.zip'); await writeFile(bad, 'not the pinned source');
    await assert.rejects(importArchive(pin, bad, join(temp, 'out')), /digest mismatch/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
