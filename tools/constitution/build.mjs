import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { articles, amendmentTitles, amendmentParts, questions, interpretationRequired, historicalLinks, institutions, authorityLinks } from './structure.mjs';

export const root = resolve(import.meta.dirname, '../..');
export const pins = [
  { id: 'us.archives.constitution', url: 'https://www.archives.gov/founding-docs/constitution-transcript', sha256: '14201a4a40027c4652106f45bf92f67738b9df109d61159b148d07786c1c3b1d' },
  { id: 'us.archives.bill_of_rights', url: 'https://www.archives.gov/founding-docs/bill-of-rights-transcript', sha256: '3c6e60165cabce6184f9c24b7b3e27a07a6ad2079ea6474f41c098d84e5ff690' },
  { id: 'us.archives.amendments11_27', url: 'https://www.archives.gov/founding-docs/amendments-11-27', sha256: '7d2fee9fe41b427eb5fb908159837fe8e1c9df0e414e1822fd0bc3b3d284d747' },
];
export const hash = value => createHash('sha256').update(value).digest('hex');
const q = JSON.stringify;
const roman = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV','XXV','XXVI','XXVII'];
function text(html) {
  const entities = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return html.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(entity[1] === 'x' ? 2 : 1), entity[1] === 'x' ? 16 : 10));
    assert.ok(entity in entities, `Unrecognized HTML entity ${entity}`);
    return entities[entity];
  }).replace(/\s+/g, ' ').trim();
}
// This extractor is intentionally limited to these exact, hash-checked snapshots.
// It is not a general HTML importer. Block counts and authored labels are checked.
function blocks(html) {
  return [...html.matchAll(/<(h[23]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => ({ tag: m[1], text: text(m[2]) }));
}
function portion(items, start, end) {
  const i = items.findIndex(b => b.text === start);
  assert.ok(i >= 0, `Missing ${start}`);
  const j = end ? items.findIndex((b, n) => n > i && b.text === end) : items.length;
  assert.ok(j > i, `Missing boundary ${end}`);
  return items.slice(i + 1, j);
}
export async function extract(cache) {
  const sources = [];
  for (const pin of pins) {
    const bytes = await readFile(join(cache, pin.sha256));
    assert.equal(hash(bytes), pin.sha256, `Source hash mismatch: ${pin.id}`);
    sources.push(blocks(bytes.toString('utf8')));
  }
  const provisions = [];
  function add(id, group_id, label, title, unit, source, fragment, content, notes = []) {
    const executable_queries = questions[id] ?? [];
    const analysis = executable_queries.length ? 'ExecutableSubset' : interpretationRequired.has(id) ? 'InterpretationRequired' : 'Represented';
    provisions.push({ id, group_id, label, title, unit, anchor: { source_id: pins[source].id, locator: label }, url: pins[source].url + fragment, text: content, text_sha256: hash(content), analysis, executable_queries,
      unresolved: [executable_queries.length ? 'Only the named questions execute; the remainder of this provision and relevant doctrine are not fully analyzed.' : 'No executable interpretation is supplied; relevant doctrine and application remain uninvestigated.'],
      editorial_notes: notes, review: 'Unreviewed' });
  }
  add('us.const.preamble', 'us.const', 'Preamble', 'Constitutional purposes', 'Preamble', 0, '', sources[0].find(b => b.text.startsWith('We the People')).text);
  for (let a = 1; a <= 7; a++) {
    const ab = portion(sources[0], `Article. ${roman[a]}.`, a < 7 ? `Article. ${roman[a + 1]}.` : undefined);
    for (let s = 1; s <= articles[a - 1].length; s++) {
      const sectioned = a <= 4;
      const sb = sectioned ? portion(ab, `Section. ${s}.`, s < articles[a - 1].length ? `Section. ${s + 1}.` : undefined) : ab;
      const paras = sb.filter(b => b.tag === 'p');
      // Article VII is followed by attestation and signatures, outside this provision inventory.
      if (a === 7) paras.splice(1);
      assert.equal(paras.length, articles[a - 1][s - 1].length, `Article ${a}, section ${s} segmentation`);
      paras.forEach((p, c) => {
        const id = `us.const.article.${a}${sectioned ? `.s${s}` : ''}${a === 5 || a === 7 ? '' : `.c${c + 1}`}`;
        const label = `Article ${roman[a]}${sectioned ? `, section ${s}` : ''}${a === 5 || a === 7 ? '' : `, clause ${c + 1}`}`;
        add(id, `us.const.article.${a}`, label, articles[a - 1][s - 1][c], a === 5 || a === 7 ? 'Article' : 'Clause', 0, `#${a}${sectioned ? '-' + s : ''}`, p.text);
      });
    }
  }
  for (let a = 1; a <= 27; a++) {
    const title = `Amendment ${roman[a]}`;
    const src = a <= 10 ? 1 : 2;
    const heading = a <= 10 ? title : title.toUpperCase();
    const next = a === 10 ? 'Amendments 11-27' : a === 27 ? undefined : (src === 1 ? `Amendment ${roman[a+1]}` : `AMENDMENT ${roman[a+1]}`);
    let body = portion(sources[src], heading, next);
    const notes = body.filter(b => /^(Passed by Congress|Originally proposed|Note:|\*)/.test(b.text)).map(b => b.text);
    body = body.filter(b => !/^(Passed by Congress|Originally proposed|Note:|\*)/.test(b.text));
    if (a === 27) body = [body.find(b => b.text.startsWith('No law, varying'))];
    const labels = amendmentParts[a];
    if (labels) {
      const paragraphs = a === 17 || a === 19;
      if (paragraphs) assert.equal(body.filter(b => b.tag === 'p').length, labels.length);
      labels.forEach((label, i) => {
        const n = i + 1;
        const content = paragraphs ? body.filter(b => b.tag === 'p')[i].text : portion(body, `Section ${n}.`, n < labels.length ? `Section ${n+1}.` : undefined).filter(b => b.tag === 'p').map(b => b.text).join(' ');
        assert.ok(content.length > 25, `${title} ${n}`);
        add(`us.const.amendment.${a}.${paragraphs ? 'p' : 's'}${n}`, `us.const.amendment.${a}`, `${title}, ${paragraphs ? 'paragraph' : 'section'} ${n}`, label, paragraphs ? 'Paragraph' : 'Section', src, `#${roman[a].toLowerCase()}${paragraphs ? '' : n}`, content, notes);
      });
    } else {
      const paras = body.filter(b => b.tag === 'p');
      assert.equal(paras.length, 1, `Amendment ${a} segmentation`);
      add(`us.const.amendment.${a}`, `us.const.amendment.${a}`, title, amendmentTitles[a - 1], 'Amendment', src, a <= 10 ? `#amendment${roman[a]}` : `#${roman[a].toLowerCase()}`, paras[0].text, notes);
    }
  }
  const relationships = [...authorityLinks, ...historicalLinks].map(([from, to, kind, scope], i) => ({ id: `us.const.relation.${i+1}`, from, to, kind, scope, assessment_queries: questions[from] ?? [], limitations: ['This relationship records the stated scope only; it is not an automatic executable priority or a complete validity determination.'], review: 'Unreviewed' }));
  const data = { format: 'constitution-inventory-1', source_pins: pins, segmentation: 'Original Articles by conventional clause; amendments by numbered section, or editorial paragraph for XVII and XIX. Unnumbered amendments remain whole. Preamble included. Attestation, signatures and unratified proposals excluded. Whitespace normalized; linked editorial notes are separate from provision text. No consolidated current text or complete amendment history is claimed.', provisions, institutions: institutions.map(([id, description, jurisdiction]) => ({id, description, jurisdiction})), relationships };
  validate(data);
  return data;
}
export function validate(data) {
  assert.deepEqual(data.source_pins, pins);
  const ids = new Set(data.provisions.map(p => p.id));
  assert.equal(ids.size, data.provisions.length);
  assert.equal(data.provisions.filter(p => p.id.startsWith('us.const.article.')).length, 84);
  for (let i = 1; i <= 27; i++) assert.ok(data.provisions.some(p => p.group_id === `us.const.amendment.${i}`));
  const all = new Set([...ids, ...data.institutions.map(i => i.id)]);
  for (const p of data.provisions) {
    assert.equal(hash(p.text), p.text_sha256);
    assert.ok(p.text.length > 25);
    assert.equal(p.review, 'Unreviewed');
    assert.deepEqual(p.executable_queries, questions[p.id] ?? []);
    assert.ok(pins.some(pin => pin.id === p.anchor.source_id));
  }
  for (const r of data.relationships) {
    assert.ok(all.has(r.from) && all.has(r.to), `Broken relationship ${r.id}`);
    assert.equal(r.review, 'Unreviewed');
  }
}
const list = xs => `[${xs.map(q).join(', ')}]`;
const anchor = a => `SourceAnchor { source_id: ${q(a.source_id)}, locator: ${q(a.locator)} }`;
export function render(data) {
  validate(data);
  const header = '// Generated from inventory/constitution/provisions.json by tools/constitution/build.mjs.\n// Original bytes remain in the external source cache. No relationship creates a rule.\n';
  const inventory = header + 'module us.constitution.inventory;\nuse legal.inventory.{ProvisionEntry, ProvisionUnit, AnalysisStatus};\nuse std.provenance.{SourceAnchor, ReviewStatus};\n\nconst provisions: List<ProvisionEntry> = [\n' + data.provisions.map(p => `    ProvisionEntry { id: ${q(p.id)}, group_id: ${q(p.group_id)}, label: ${q(p.label)}, title: ${q(p.title)}, unit: ProvisionUnit.${p.unit}, anchor: ${anchor(p.anchor)}, text: ${q(p.text)}, analysis: AnalysisStatus.${p.analysis}, executable_queries: ${list(p.executable_queries)}, unresolved: ${list(p.unresolved)}, editorial_notes: ${list(p.editorial_notes)}, review: ReviewStatus.Unreviewed }`).join(',\n') + '\n];\n';
  const graph = header + 'module us.constitution.structure;\nuse legal.model.{Institution, AuthorityLink, RelationshipKind, Scope};\nuse legal.inventory.AuthorityRecord;\nuse std.provenance.{SourceAnchor, ReviewStatus};\n\nconst institutions: List<Institution> = [\n' + data.institutions.map(i => `    Institution { id: ${q(i.id)}, description: ${q(i.description)}, jurisdiction: ${q(i.jurisdiction)} }`).join(',\n') + '\n];\n\nconst relationships: List<AuthorityRecord> = [\n' + data.relationships.map(r => {
    const p = data.provisions.find(p => p.id === r.from);
    return `    AuthorityRecord { id: ${q(r.id)}, link: AuthorityLink { from_id: ${q(r.from)}, to_id: ${q(r.to)}, kind: RelationshipKind.${r.kind}, scope: Scope { parties: [], places: [], questions: ${list(r.assessment_queries)}, description: ${q(r.scope)} }, anchors: [${anchor(p.anchor)}] }, assessment_queries: ${list(r.assessment_queries)}, limitations: ${list(r.limitations)}, review: ReviewStatus.Unreviewed }`;
  }).join(',\n') + '\n];\n';
  return { 'inventory.oath': inventory, 'structure.oath': graph };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [mode, cache] = process.argv.slice(2);
  assert.ok(mode === '--cache' || mode === '--check', 'Usage: node tools/constitution/build.mjs --cache EXTERNAL_CACHE | --check');
  const file = join(root, 'inventory/constitution/provisions.json');
  const data = mode === '--cache' ? await extract(resolve(cache)) : JSON.parse(await readFile(file, 'utf8'));
  if (mode === '--cache') { await mkdir(resolve(file, '..'), { recursive: true }); await writeFile(file, JSON.stringify(data, null, 2) + '\n'); }
  for (const [name, content] of Object.entries(render(data))) {
    const path = join(root, 'us/federal/constitution/src', name);
    if (mode === '--cache') await writeFile(path, content);
    else assert.equal(await readFile(path, 'utf8'), content, `Stale ${name}`);
  }
  console.log(`${data.provisions.length} provisions; ${data.relationships.length} scoped relationships; ${data.institutions.length} institutional actors.`);
}
