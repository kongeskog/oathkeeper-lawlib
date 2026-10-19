import { createReadStream, openSync, closeSync, writeSync } from 'node:fs';
import { readFile, writeFile, mkdir, stat, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import yauzl from 'yauzl';
import { createIndexer } from './uslm.mjs';

export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function checkPin(pin) {
  if (pin.format !== 'lawlib-source-pin/1' || !/^\d+-\d+$/.test(pin.release)
      || !/^[a-f0-9]{64}$/.test(pin.sha256) || !Number.isSafeInteger(pin.bytes)
      || pin.bytes < 1 || pin.bytes > 512 * 1024 * 1024
      || !Number.isSafeInteger(pin.expected_xml_documents) || pin.expected_xml_documents < 1
      || pin.expected_xml_documents > 200) throw new Error('Invalid source pin');
  const url = new URL(pin.url);
  if (url.protocol !== 'https:' || url.hostname !== 'uscode.house.gov' || url.username || url.password) throw new Error('Expected official OLRC HTTPS URL');
}
export function checkEntry(entry) {
  if (!/^usc\d{2}[Aa]?\.xml$/.test(entry.fileName)) throw new Error(`Unexpected archive entry: ${entry.fileName}`);
  if (entry.generalPurposeBitFlag & 1) throw new Error('Encrypted ZIP entries are unsupported');
  if (entry.uncompressedSize > 512 * 1024 * 1024) throw new Error('XML size limit exceeded');
}
async function fetchPinned(pin, file) {
  const response = await fetch(pin.url, { redirect: 'error', signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  let bytes = 0;
  const temp = `${file}.download`;
  try {
    await pipeline(response.body, async function* (stream) {
      for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > pin.bytes) throw new Error('Source exceeds pinned byte size');
        yield chunk;
      }
    }, createWriteStream(temp, { flags: 'wx' }));
    if (bytes !== pin.bytes || await hashFile(temp) !== pin.sha256) throw new Error('Downloaded source digest mismatch');
    await rename(temp, file);
  } catch (error) { await rm(temp, { force: true }); throw error; }
}
export async function importArchive(pin, archive, destination) {
  checkPin(pin);
  if ((await stat(archive)).size !== pin.bytes || await hashFile(archive) !== pin.sha256) throw new Error('Source size or digest mismatch');
  // Exclusive output prevents accidental replacement of an earlier inventory.
  await mkdir(destination);
  const zip = await new Promise((ok, no) => yauzl.open(archive, { lazyEntries: true, autoClose: false, strictFileNames: true }, (err, z) => err ? no(err) : ok(z)));
  const names = new Set();
  const documents = [];
  let expanded = 0;
  const zipError = new Promise((_, reject) => zip.on('error', reject));
  // Attach a handler even between reads; awaited races below propagate failures.
  zipError.catch(() => {});
  try {
    while (true) {
      const next = new Promise(resolveNext => {
        const onEntry = entry => { zip.off('end', onEnd); resolveNext(entry); };
        const onEnd = () => { zip.off('entry', onEntry); resolveNext(null); };
        zip.once('entry', onEntry); zip.once('end', onEnd); zip.readEntry();
      });
      const entry = await Promise.race([next, zipError]);
      if (!entry) break;
      checkEntry(entry);
      if (names.has(entry.fileName.toLowerCase())) throw new Error('Duplicate archive entry');
      names.add(entry.fileName.toLowerCase());
      if (names.size > pin.expected_xml_documents) throw new Error('Too many XML documents');
      expanded += entry.uncompressedSize;
      if (expanded > 2 * 1024 ** 3) throw new Error('Expanded archive limit exceeded');
      const stream = await new Promise((ok, no) => zip.openReadStream(entry, (err, s) => err ? no(err) : ok(s)));
      const rawHash = createHash('sha256');
      const indexHash = createHash('sha256');
      const indexName = `${entry.fileName}.jsonl`;
      const fd = openSync(join(destination, indexName), 'wx');
      let buffer = '', indexBytes = 0, rawBytes = 0;
      const flush = () => {
        const bytes = Buffer.from(buffer, 'utf8');
        indexHash.update(bytes); indexBytes += bytes.length;
        // writeSync may legally make a partial write.
        for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset, bytes.length - offset);
        buffer = '';
      };
      const parser = createIndexer(entry.fileName, record => {
        buffer += JSON.stringify(record) + '\n';
        if (buffer.length > 65536) flush();
      });
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let summary;
      try {
        for await (const chunk of stream) {
          rawBytes += chunk.length;
          if (rawBytes > entry.uncompressedSize) throw new Error('XML exceeds declared size');
          rawHash.update(chunk); parser.write(decoder.decode(chunk, { stream: true }));
        }
        parser.write(decoder.decode()); summary = parser.finish(); flush();
      } finally { closeSync(fd); stream.destroy(); }
      if (summary.publication !== `Online@${pin.release}`) throw new Error(`Unexpected publication: ${summary.publication}`);
      if (rawBytes !== entry.uncompressedSize) throw new Error('Truncated XML document');
      documents.push({ ...summary, sha256: rawHash.digest('hex'), bytes: rawBytes,
        index: { file: indexName, sha256: indexHash.digest('hex'), bytes: indexBytes },
        status: { source_audit: 'Matched', executable_coverage: 'NotAssessed', semantic_tests: 'NotAssessed', legal_review: 'Unreviewed' },
      });
      process.stderr.write(`Indexed ${entry.fileName}: ${summary.counts.section ?? 0} section elements\n`);
    }
    if (documents.length !== pin.expected_xml_documents) throw new Error('Missing XML documents');
    documents.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    const totals = {};
    for (const doc of documents) for (const [kind, count] of Object.entries(doc.counts)) totals[kind] = (totals[kind] ?? 0) + count;
    const manifest = {
      format: 'lawlib-usc-inventory/1', extractor: 'lawlib-uslm-index/1', source: pin,
      counts: { documents: documents.length, elements: documents.reduce((n, d) => n + d.elements, 0), records: documents.reduce((n, d) => n + d.records, 0), by_kind: totals },
      interpretation: 'Publisher structure and cross-references only. Section counts include repealed, omitted, reserved and appendix material; they are not counts of operative laws. Note groups are publisher labels, not determinations of legal force. No references are resolved automatically.',
      documents,
    };
    // Published last: a partial directory never has a completion manifest.
    await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return manifest;
  } finally { zip.close(); }
}

async function main() {
  const [pinPath, cachePath, ...flags] = process.argv.slice(2);
  if (!pinPath || !cachePath || flags.some(f => f !== '--fetch')) throw new Error('Usage: node import-usc.mjs PIN_JSON CACHE_DIRECTORY [--fetch]');
  const pin = JSON.parse(await readFile(pinPath, 'utf8')); checkPin(pin);
  const cache = resolve(cachePath); await mkdir(cache, { recursive: true });
  const archive = join(cache, pin.sha256);
  try { await stat(archive); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!flags.includes('--fetch')) throw new Error(`Source unavailable: place the pinned ZIP at ${archive}, or explicitly use --fetch`);
    await fetchPinned(pin, archive);
  }
  const destination = join(cache, `usc-${pin.release}-index-v1`);
  await importArchive(pin, archive, destination);
  console.log(join(destination, 'manifest.json'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
