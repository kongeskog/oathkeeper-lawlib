import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { provisionParser, hash } from './provisions.mjs';
import { checkedGzip, gzipShard } from './extract-provisions.mjs';
import { compareUnits, affectedEncodings, validateRegistry } from './impact.mjs';
import { renderDraft } from './draft.mjs';
import { materialize } from './materialize.mjs';

const xml = body => `<uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0"><main><title identifier="/us/usc/t1"><num>Title 1</num><heading>General</heading>${body}</title></main></uscDoc>`;
function parse(body) { const units = []; const p = provisionParser('usc01.xml', u => units.push(u)); for (const c of xml(body)) p.write(c); p.finish(); return units; }
test('format-1 compressed bytes are reproducible across operating systems', () => {
  const fixture = [{ key: '/us/usc/t1/s1', body: 'A rule.' }];
  assert.equal(gzipShard(fixture).toString('hex'),
    '1f8b080000000000020a8bae56ca4ead54b252d22f2dd62f2d4ed62f31d42f3654d2514aca4f01093b2a1495e6a4ea29d5c6020011b7802a2a000000');
});
test('separates operative text, editorial notes, credits and reference context', () => {
  const [u, standalone] = parse('<section identifier="/us/usc/t1/s1"><num>§ 1.</num><heading>Words</heading><content>Body <ref href="/us/usc/t1/s2">section 2</ref>.</content><sourceCredit>Act of 1900</sourceCredit><notes><note role="crossHeading" topic="editorialNotes">Editorial Notes</note><note topic="amendments">Changed <ref href="/us/pl/1/2">Act</ref><quotedContent><section><content>quoted</content></section></quotedContent></note></notes></section><notes><note identifier="/note/outside">Title-wide note</note></notes>');
  assert.equal(u.heading, 'Words'); assert.equal(u.body, 'Body section 2.');
  assert.deepEqual(u.credits, ['Act of 1900']);
  assert.equal(u.notes[1].group, 'editorialNotes'); assert.match(u.notes[1].text, /quoted/);
  assert.deepEqual(u.references.map(r => r.context), ['body', 'note']);
  assert.equal(standalone.kind, 'note'); assert.equal(standalone.notes[0].text, 'Title-wide note');
  assert.equal(u.hierarchy[0].heading, 'General');
});
test('content identity ignores volatile XML IDs but detects changed notes', () => {
  const section = (id, note) => `<section id="${id}" identifier="/s1"><content>same</content><notes><note>${note}</note></notes></section>`;
  const [a] = parse(section('a', 'old')), [b] = parse(section('b', 'old')), [c] = parse(section('b', 'new'));
  assert.equal(a.content_sha256, b.content_sha256);
  assert.deepEqual(compareUnits([a], [c])[0].changed_parts, ['notes']);
});
test('changes in a provision parent heading are included in source impact', () => {
 const content='<section identifier="/s1"><content>Same words</content></section>';
 const [a]=parse(content),units=[];
 const p=provisionParser('usc01.xml',u=>units.push(u));p.write(xml(content).replace('General','Different scope'));p.finish();
 assert.deepEqual(compareUnits([a],units)[0].changed_parts,['context']);
});
test('rejects DTDs, foreign roots and bounded text/depth violations', () => {
  for (const document of ['<!DOCTYPE uscDoc [<!ENTITY x "x">]>' + xml(''), '<uscDoc/>']) assert.throws(() => { const p = provisionParser('x', () => {}); p.write(document); p.finish(); });
  const p = provisionParser('x', () => {}, {text: 3}); assert.throws(() => p.write(xml('<section><content>long text</content></section>')), /limit/);
});
test('content retrieval rejects digest tampering and path traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oath-provision-test-'));
  const bytes = gzipSync('[1]'); await writeFile(join(root, 'unit.json.gz'), bytes);
  const ref = {path:'unit.json.gz',sha256:hash(bytes),bytes:bytes.length};
  assert.deepEqual(await checkedGzip(root,ref),[1]);
  await assert.rejects(checkedGzip(root,{...ref,sha256:'0'.repeat(64)}),/integrity/);
  await assert.rejects(checkedGzip(root,{...ref,path:'../unit.json.gz'}),/Invalid/);
});
test('source change propagates through explicit encoding dependencies and tests', () => {
  const [before] = parse('<section identifier="/s1"><content>21 days</content></section>');
  const [after] = parse('<section identifier="/s1"><content>28 days</content></section>');
  const registry = {format:'lawlib-encodings/1',encodings:[
    {id:'period',package:'p',query:'p.q',tests:['tests/period.json'],depends_on:[],sources:[{collection:'usc',release:'1-1',file:'usc01.xml',locator:'/s1',content_sha256:before.content_sha256}]},
    {id:'answer',package:'a',query:'a.q',tests:['tests/answer.json'],depends_on:['period'],sources:[]}
  ]};
  const changes = compareUnits([before],[after]).map(c=>({file:'usc01.xml',...c}));
  const affected = affectedEncodings(changes,registry,'1-1','1-2');
  assert.deepEqual(affected.map(e=>e.id),['answer','period']);
  assert.deepEqual(affected[0].through,['period']); assert.equal(affected[1].reasons[0].binding_digest_matches,true);
  assert.deepEqual(affected[0].tests,['tests/answer.json']);
  assert.deepEqual(affectedEncodings([],registry,'1-1','1-2'),[]);
  const cycle = structuredClone(registry); cycle.encodings[0].depends_on=['answer']; assert.throws(()=>validateRegistry(cycle),/cycle/);
  assert.equal(compareUnits([before,before],[after])[0].kind,'IdentityReviewRequired');
  const moved = {...after,locator:'/s2'};
  assert.deepEqual(compareUnits([before],[moved]).map(c=>c.kind),['RemovedText','AddedText']);
});
test('draft remains unimplemented, binds original XML hash and escapes source text', () => {
  const [unit] = parse('<section identifier="/s1"><heading>A &quot;quote&quot;</heading><content>Text</content></section>');
  const files=renderDraft({unit,document:{file:'usc01.xml',sha256:'a'.repeat(64)},catalog:{source:{release:'1-1',url:'https://example.test/a.zip',sha256:'b'.repeat(64)}}},{packageName:'draft.demo',moduleName:'draft.demo',stdPath:'../stdlib',question:'What applies?'});
  assert.match(files['src/main.oath'],/expected_sha256: "aaaa/);
  assert.doesNotMatch(files['src/main.oath'],/^rule /m);
  assert.equal(JSON.parse(files['tests/unimplemented.json']).expected.status,'undetermined');
  assert.throws(()=>renderDraft({},{}));
});
test('bundle writer rejects extra paths and existing destinations', async () => {
 const root=await mkdtemp(join(tmpdir(),'oath-draft-test-'));
 const [unit]=parse('<section identifier="/s1"><content>text</content></section>');
 const files=renderDraft({unit,document:{file:'usc01.xml',sha256:'a'.repeat(64)},catalog:{source:{release:'1-1',url:'https://example.test',sha256:'b'.repeat(64)}}},{packageName:'draft.test',moduleName:'draft.test',stdPath:'../std',question:'Question?'});
 await assert.rejects(materialize({format:'lawlib-draft-bundle/1',files:{...files,'../escape':'bad'}},join(root,'unsafe')),/Invalid/);
 await materialize({format:'lawlib-draft-bundle/1',files},join(root,'safe'));
 await assert.rejects(materialize({format:'lawlib-draft-bundle/1',files},join(root,'safe')),/EEXIST/);
});
