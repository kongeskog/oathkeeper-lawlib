import { loadCatalog, checkedGzip } from './extract-provisions.mjs';
import { hash, canonical } from './provisions.mjs';

export function validateRegistry(registry) {
  if (registry.format !== 'lawlib-encodings/1' || !Array.isArray(registry.encodings)) throw new Error('Invalid encoding registry');
  const ids = new Set();
  for (const e of registry.encodings) {
    if (!e.id || ids.has(e.id) || !Array.isArray(e.sources) || !Array.isArray(e.depends_on) || !Array.isArray(e.tests)) throw new Error('Invalid or duplicate encoding');
    ids.add(e.id);
    for (const s of e.sources) if (s.collection !== 'usc' || !/^\d+-\d+$/.test(s.release) || !/^usc\d{2}[Aa]?\.xml$/.test(s.file) || !/^[a-f0-9]{64}$/.test(s.content_sha256) || (!s.locator && !s.key)) throw new Error('Invalid source binding');
  }
  const seen = new Set(), active = new Set(), byId = new Map(registry.encodings.map(e => [e.id, e]));
  function visit(id) {
    if (!ids.has(id)) throw new Error(`Unknown encoding dependency: ${id}`);
    if (active.has(id)) throw new Error('Encoding dependency cycle');
    if (seen.has(id)) return;
    active.add(id); for (const next of byId.get(id).depends_on) visit(next); active.delete(id); seen.add(id);
  }
  for (const id of ids) visit(id);
}
export function compareUnits(before, after) {
  const group = rows => {
    const map = new Map();
    for (const r of rows) { const id = r.locator ?? 'unlocated:document'; map.set(id, [...(map.get(id) ?? []), r]); }
    return map;
  };
  const old = group(before), next = group(after), changes = [];
  for (const locator of [...new Set([...old.keys(), ...next.keys()])].sort()) {
    const a = old.get(locator) ?? [], b = next.get(locator) ?? [];
    if (a.length > 1 || b.length > 1 || locator.startsWith('unlocated:')) {
      if (canonical(a.map(x => x.content_sha256).sort()) !== canonical(b.map(x => x.content_sha256).sort())) changes.push({ locator: a[0]?.locator ?? b[0]?.locator ?? null, kind: 'IdentityReviewRequired', before: a, after: b, changed_parts: [] });
      continue;
    }
    if (!a.length || !b.length || a[0].content_sha256 !== b[0].content_sha256) {
      const changed_parts = a.length && b.length ? Object.keys(a[0].part_hashes).filter(k => a[0].part_hashes[k] !== b[0].part_hashes[k]) : [];
      changes.push({ locator, kind: !a.length ? 'AddedText' : !b.length ? 'RemovedText' : 'ChangedText', before: a, after: b, changed_parts });
    }
  }
  return changes;
}
export function affectedEncodings(changes, registry, beforeRelease, afterRelease) {
  validateRegistry(registry);
  const affected = new Map();
  for (const e of registry.encodings) {
    const direct = [];
    for (const s of e.sources) {
      if (![beforeRelease, afterRelease].includes(s.release)) continue;
      for (const c of changes) if (c.file === s.file && ((s.locator && c.locator === s.locator) || (!s.locator && [...c.before, ...c.after].some(u => u.key === s.key)))) {
        const pinned = (s.release === beforeRelease ? c.before : c.after).some(u => u.content_sha256 === s.content_sha256);
        direct.push({ file: s.file, locator: s.locator, change: c.kind, binding_snapshot: s.release === beforeRelease ? 'Before' : 'After', binding_digest_matches: pinned });
      }
    }
    if (direct.length) affected.set(e.id, { id: e.id, package: e.package, query: e.query, tests: e.tests, reasons: direct, through: [], action: 'Reassess; no legal effect or review approval inferred' });
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of registry.encodings) {
      const through = e.depends_on.filter(id => affected.has(id));
      if (through.length && !affected.has(e.id)) { affected.set(e.id, { id: e.id, package: e.package, query: e.query, tests: e.tests, reasons: [], through, action: 'Reassess dependency and rerun authored tests' }); changed = true; }
      else if (affected.has(e.id)) affected.get(e.id).through = through;
    }
  }
  return [...affected.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export async function impact(beforeRoot, afterRoot, registry) {
  validateRegistry(registry);
  const before = await loadCatalog(beforeRoot), after = await loadCatalog(afterRoot);
  const changes = [];
  for (const file of [...new Set([...before.documents, ...after.documents].map(d => d.file))].sort()) {
    const a = before.documents.find(d => d.file === file), b = after.documents.find(d => d.file === file);
    const old = a ? await checkedGzip(beforeRoot, a.index) : { units: [] };
    const next = b ? await checkedGzip(afterRoot, b.index) : { units: [] };
    changes.push(...compareUnits(old.units, next.units).map(c => ({ file, ...c })));
  }
  return {
    format: 'lawlib-impact/1', before: { release: before.source.release, archive_sha256: before.source.sha256, catalog_sha256: hash(canonical(before)) }, after: { release: after.source.release, archive_sha256: after.source.sha256, catalog_sha256: hash(canonical(after)) },
    registry_sha256: hash(canonical(registry)), changes,
    affected: affectedEncodings(changes, registry, before.source.release, after.source.release),
    limitations: ['Matches unique locators within documents; renumbering and relocation require explicit identity review', 'Text additions/removals are not automatic enactments or repeals', 'Only registered source and encoding-dependency links contribute to impact; omitted dependencies remain undiscovered', 'An unchanged encoded source does not establish that no other law changed'],
  };
}
