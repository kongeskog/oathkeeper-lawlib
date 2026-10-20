import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import yauzl from 'yauzl';
import { checkPin, checkEntry, hashFile } from './import-usc.mjs';
import { provisionParser, hash, canonical } from './provisions.mjs';

// Format /1 catalogs were published with gzip's Windows OS byte (10). Fix that
// non-semantic header field so Linux reproduces those exact compressed digests.
// This is a serialization convention, not a claim about the source's platform.
export function gzipShard(value) {
  const bytes = gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 });
  bytes[9] = 10;
  return bytes;
}

export async function extract(pin, archive, output) {
  checkPin(pin);
  if ((await stat(archive)).size !== pin.bytes || await hashFile(archive) !== pin.sha256) throw new Error('Source digest mismatch');
  await mkdir(output);
  const zip = await new Promise((ok, no) => yauzl.open(archive, { lazyEntries: true, autoClose: false, strictFileNames: true }, (e, z) => e ? no(e) : ok(z)));
  const failure = new Promise((_, reject) => zip.on('error', reject)); failure.catch(() => {});
  const documents = [], names = new Set(); let expanded = 0, total = 0;
  try {
    while (true) {
      const next = new Promise(ok => {
        const entry = e => { zip.off('end', end); ok(e); };
        const end = () => { zip.off('entry', entry); ok(null); };
        zip.once('entry', entry); zip.once('end', end); zip.readEntry();
      });
      const entry = await Promise.race([next, failure]); if (!entry) break;
      checkEntry(entry);
      if (names.has(entry.fileName.toLowerCase()) || names.size >= pin.expected_xml_documents) throw new Error('Duplicate or excessive XML documents');
      names.add(entry.fileName.toLowerCase()); expanded += entry.uncompressedSize;
      if (expanded > 2 * 1024 ** 3) throw new Error('Archive expansion limit');
      const rawHash = createHash('sha256'), decoder = new TextDecoder('utf-8', { fatal: true });
      let rawBytes = 0, rows = [], chunk = [], chunkNumber = 0, chunkBytes = 0;
      const chunks = [], pending = [];
      const flush = () => {
        if (!chunk.length) return;
        const path = `${entry.fileName}.${chunkNumber++}.json.gz`;
        const bytes = gzipShard(chunk);
        chunks.push({ path, sha256: hash(bytes), bytes: bytes.length, count: chunk.length });
        pending.push(writeFile(join(output, path), bytes, { flag: 'wx' }));
        chunk = []; chunkBytes = 0;
      };
      const parser = provisionParser(entry.fileName, unit => {
        const jsonSize = Buffer.byteLength(JSON.stringify(unit));
        if (chunk.length >= 32 || chunkBytes + jsonSize > 1024 ** 2) flush();
        rows.push({ key: unit.key, locator: unit.locator, kind: unit.kind, number: unit.number, heading: unit.heading, content_sha256: unit.content_sha256, part_hashes: unit.part_hashes, chunk: `${entry.fileName}.${chunkNumber}.json.gz`, note_count: unit.notes.length, reference_count: unit.references.length });
        chunk.push(unit); chunkBytes += jsonSize;
      });
      const stream = await new Promise((ok, no) => zip.openReadStream(entry, (e, s) => e ? no(e) : ok(s)));
      let summary;
      try {
        for await (const bytes of stream) {
          rawBytes += bytes.length; if (rawBytes > entry.uncompressedSize) throw new Error('XML size mismatch');
          rawHash.update(bytes); parser.write(decoder.decode(bytes, { stream: true }));
          // Bound in-flight writes without retaining a whole title's body text.
          if (pending.length >= 8) await Promise.all(pending.splice(0));
        }
        parser.write(decoder.decode()); summary = parser.finish(); flush(); await Promise.all(pending);
      } finally { stream.destroy(); }
      if (rawBytes !== entry.uncompressedSize || summary.publication !== `Online@${pin.release}`) throw new Error('Wrong XML size or publication');
      const source = { file: entry.fileName, sha256: rawHash.digest('hex'), bytes: rawBytes };
      const index = { format: 'lawlib-provision-index/1', source, chunks, units: rows };
      const bytes = gzipShard(index);
      const indexPath = `${entry.fileName}.index.json.gz`;
      await writeFile(join(output, indexPath), bytes, { flag: 'wx' });
      documents.push({ ...source, title: summary.documentTitle, count: summary.count, index: { path: indexPath, sha256: hash(bytes), bytes: bytes.length } });
      total += summary.count; process.stderr.write(`Extracted ${entry.fileName}: ${summary.count} provisions\n`);
    }
    if (documents.length !== pin.expected_xml_documents) throw new Error('Missing source documents');
    documents.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    const catalog = { format: 'lawlib-provisions/1', extractor: 'lawlib-uslm-provisions/1', source: pin, count: total, documents };
    await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
    return catalog;
  } finally { zip.close(); }
}
export async function checkedGzip(root, ref) {
  if (!/^[A-Za-z0-9.-]+\.json\.gz$/.test(ref.path) || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw new Error('Invalid content reference');
  const bytes = await readFile(join(root, ref.path));
  if (bytes.length !== ref.bytes || hash(bytes) !== ref.sha256) throw new Error(`Content integrity failure: ${ref.path}`);
  return JSON.parse(gunzipSync(bytes, { maxOutputLength: 128 * 1024 ** 2 }).toString('utf8'));
}
export async function loadCatalog(root) {
  const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
  if (catalog.format !== 'lawlib-provisions/1') throw new Error('Unsupported catalog');
  checkPin(catalog.source); return catalog;
}
export async function loadUnit(root, file, key) {
  const catalog = await loadCatalog(root), document = catalog.documents.find(d => d.file === file);
  if (!document) throw new Error('Unknown source document');
  const index = await checkedGzip(root, document.index);
  const matches = index.units.filter(u => u.key === key || u.locator === key);
  if (matches.length !== 1) throw new Error('Provision locator is absent or ambiguous; use its snapshot key');
  const row = matches[0], ref = index.chunks.find(c => c.path === row.chunk);
  const units = await checkedGzip(root, ref), unit = units.find(u => u.key === row.key);
  if (!unit || unit.content_sha256 !== row.content_sha256) throw new Error('Unit/index mismatch');
  return { catalog, document, unit };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [pinPath, archive, output] = process.argv.slice(2);
  if (!pinPath || !archive || !output) { console.error('Usage: node extract-provisions.mjs PIN ARCHIVE NEW_OUTPUT_DIRECTORY'); process.exitCode = 2; }
  else extract(JSON.parse(await readFile(pinPath, 'utf8')), archive, output).catch(e => { console.error(e); process.exitCode = 1; });
}
