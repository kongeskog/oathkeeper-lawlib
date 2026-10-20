import { SaxesParser } from 'saxes';
import { createHash } from 'node:crypto';
import { USLM } from './uslm.mjs';

export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
export const hash = value => createHash('sha256').update(value).digest('hex');
const clean = text => text.replace(/[\t \r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// Notes and credits outside a section are first-class browseable source units.
// Units are publisher structure, not a count of operative legal provisions.
const unitKinds = new Set(['section', 'courtRule', 'reorganizationPlan', 'compiledAct', 'note', 'sourceCredit']);
const breaks = new Set(['p', 'paragraph', 'subsection', 'subparagraph', 'clause', 'subclause', 'heading', 'num', 'chapeau', 'content', 'tr']);

export function provisionParser(file, emit, limits = {}) {
  const parser = new SaxesParser({ xmlns: true, fileName: file });
  const stack = []; let ordinal = 0, current = null, note = null, credit = null;
  let publication = '', documentTitle = '', count = 0;
  const maxText = limits.text ?? 32 * 1024 ** 2;
  const maxDepth = limits.depth ?? 256;
  parser.on('error', e => { throw e; });
  parser.on('doctype', () => { throw new Error('DOCTYPE is unsupported'); });
  parser.on('opentag', tag => {
    if (stack.length >= maxDepth || ++ordinal > 5_000_000) throw new Error('XML resource limit exceeded');
    if (!stack.length && (tag.uri !== USLM || tag.local !== 'uscDoc')) throw new Error('Expected USLM uscDoc');
    const attrs = Object.fromEntries(Object.values(tag.attributes).map(a => [a.name, a.value]));
    const parent = stack.at(-1);
    const frame = { kind: tag.local, uri: tag.uri, attrs, ordinal, label: '', number: '', heading: '', group: parent?.group ?? null };
    if (!current && tag.uri === USLM && unitKinds.has(tag.local) && !stack.some(f => f.kind === 'quotedContent')) {
      current = {
        key: hash(`${file}\0${ordinal}`).slice(0, 24), locator: attrs.identifier ?? null,
        xml_id: attrs.id ?? null, kind: tag.local, element: ordinal, number: '', heading: '',
        hierarchy: stack.filter(f => f.attrs.identifier && !['uscDoc', 'main'].includes(f.kind)).map(f => ({ kind: f.kind, locator: f.attrs.identifier, number: f.number, heading: f.heading })),
        body: '', notes: [], credits: [], references: [],
      };
    }
    if (current && tag.uri === USLM) {
      if (tag.local === 'note' && !note) {
        note = { element: ordinal, topic: attrs.topic ?? null, role: attrs.role ?? null, group: [...stack].reverse().find(f => f.kind === 'notes')?.group ?? null, locator: attrs.identifier ?? null, text: '' };
      }
      if (tag.local === 'sourceCredit' && !credit) credit = { element: ordinal, text: '' };
      if (tag.local === 'ref') frame.reference = { href: attrs.href ?? '', text: '', context: note ? 'note' : credit ? 'sourceCredit' : 'body' };
    }
    stack.push(frame);
  });
  function append(text) {
    for (const frame of stack) {
      if (['num', 'heading', 'docPublicationName'].includes(frame.kind) || (frame.kind === 'title' && frame.uri === 'http://purl.org/dc/elements/1.1/')) {
        frame.label += text;
        if (frame.label.length > 1024 ** 2) throw new Error('Label limit exceeded');
      }
      if (frame.reference) frame.reference.text += text;
    }
    if (!current) return;
    const target = note ?? credit ?? current;
    const field = note || credit ? 'text' : 'body';
    // Unit headings and numbers are retained separately. Nested labels remain in text.
    const isUnitLabel = stack.some((f, i) => ['num', 'heading'].includes(f.kind) && stack[i - 1]?.ordinal === current.element);
    if (!note && !credit && isUnitLabel) return;
    target[field] += text;
    if (target[field].length > maxText) throw new Error('Provision text limit exceeded');
  }
  parser.on('text', append); parser.on('cdata', append);
  parser.on('closetag', () => {
    const frame = stack.pop(), parent = stack.at(-1);
    if (frame.kind === 'docPublicationName') publication = clean(frame.label);
    if (frame.kind === 'title' && frame.uri === 'http://purl.org/dc/elements/1.1/') documentTitle = clean(frame.label);
    if (['num', 'heading'].includes(frame.kind) && parent) {
      const field = frame.kind === 'num' ? 'number' : 'heading';
      parent[field] = clean(frame.label);
      if (current?.element === parent.ordinal) current[field] = clean(frame.label);
    }
    if (frame.reference && current) current.references.push({ ...frame.reference, text: clean(frame.reference.text) });
    if (note?.element === frame.ordinal) {
      if (note.role === 'crossHeading' && parent?.kind === 'notes') parent.group = note.topic;
      current.notes.push({ ...note, text: clean(note.text) }); note = null;
    }
    if (credit?.element === frame.ordinal) { current.credits.push(clean(credit.text)); credit = null; }
    if (current && breaks.has(frame.kind)) {
      const target = note ?? credit ?? current;
      target[note || credit ? 'text' : 'body'] += '\n';
    }
    if (current?.element === frame.ordinal) {
      current.body = clean(current.body);
      // Volatile XML IDs and positional locators do not turn republication into a text change.
      const parts = {
        text: { number: current.number, heading: current.heading, body: current.body },
        notes: current.notes.map(({ element, ...n }) => n), credits: current.credits, references: current.references,
        context: current.hierarchy,
      };
      current.part_hashes = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, hash(canonical(v))]));
      current.content_sha256 = hash(canonical(parts));
      emit(current); count++; current = null;
    }
  });
  return { write: value => parser.write(value), finish: () => { parser.close(); return { publication, documentTitle, count }; } };
}
