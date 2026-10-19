import { SaxesParser } from 'saxes';

export const USLM = 'http://xml.house.gov/schemas/uslm/1.0';
const indexed = new Set(['uscDoc', 'title', 'chapter', 'subchapter', 'part', 'subpart', 'section', 'subsection', 'paragraph', 'subparagraph', 'clause', 'subclause', 'item', 'subitem', 'division', 'subdivision', 'level', 'rule', 'article', 'notes', 'note', 'sourceCredit', 'ref']);
const normalize = text => text.replace(/\s+/gu, ' ').trim();

// This is a loss-aware discovery index. The pinned XML is the lossless source.
// Element ordinals are snapshot locators, never stable legal provision IDs.
export function createIndexer(file, emit, limits = {}) {
  const maxDepth = limits.depth ?? 256;
  const maxElements = limits.elements ?? 5_000_000;
  const maxLabel = limits.label ?? 1_048_576;
  const parser = new SaxesParser({ xmlns: true, fileName: file });
  const stack = [];
  let primaryNode;
  const summary = { file, document_title: '', identifier: '', number: '', heading: '', publication: '', positive_law: '', elements: 0, records: 0, counts: {} };
  parser.on('doctype', () => { throw new Error('DOCTYPE is not supported'); });
  parser.on('error', error => { throw error; });
  parser.on('opentag', tag => {
    if (++summary.elements > maxElements) throw new Error('Element limit exceeded');
    if (stack.length >= maxDepth) throw new Error('XML depth limit exceeded');
    if (!stack.length && (tag.local !== 'uscDoc' || tag.uri !== USLM)) throw new Error('Expected USLM uscDoc root');
    const attributes = Object.fromEntries(Object.values(tag.attributes).map(a => [a.name, a.value]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    const parent = stack.at(-1);
    const included = tag.uri === USLM && (indexed.has(tag.local) || attributes.identifier !== undefined);
    const ancestor = parent?.record ?? parent?.ancestor;
    const record = included ? {
      node: `${file}#element-${summary.elements}`,
      parent: ancestor?.node ?? null,
      kind: tag.local,
      attributes,
      number: '',
      heading: '',
      source_note_group: [...stack].reverse().find(f => f.tag.local === 'notes')?.noteGroup ?? null,
    } : null;
    if (record) {
      summary.records++;
      summary.counts[tag.local] = (summary.counts[tag.local] ?? 0) + 1;
      if (['main', 'uscDoc'].includes(parent?.tag.local) && ['title', 'appendix'].includes(tag.local)) primaryNode = record.node;
    }
    const capture = ['num', 'heading', 'docPublicationName', 'property'].includes(tag.local)
      || (tag.local === 'title' && parent?.tag.local === 'meta')
      || (tag.local === 'ref' && tag.uri === USLM);
    stack.push({ tag, attributes, record, ancestor, text: capture ? '' : null, noteGroup: null });
    if (stack.length === 1) summary.identifier = attributes.identifier ?? '';
  });
  const onText = text => {
    for (const frame of stack) if (frame.text !== null) {
      if (frame.text.length + text.length > maxLabel) throw new Error('Label limit exceeded');
      frame.text += text;
    }
  };
  parser.on('text', onText);
  parser.on('cdata', onText);
  parser.on('closetag', () => {
    const frame = stack.pop();
    const parent = stack.at(-1);
    const text = normalize(frame.text ?? '');
    if (frame.tag.local === 'title' && frame.tag.uri === 'http://purl.org/dc/elements/1.1/' && parent?.tag.local === 'meta') summary.document_title = text;
    if (frame.tag.uri === USLM) {
      if (['num', 'heading'].includes(frame.tag.local) && parent?.record) {
        parent.record[frame.tag.local === 'num' ? 'number' : 'heading'] = text;
      }
      if (frame.tag.local === 'docPublicationName') summary.publication = text;
      if (frame.tag.local === 'property' && frame.attributes.role === 'is-positive-law') summary.positive_law = text;
      if (frame.record && frame.record.node === primaryNode) {
        summary.heading = frame.record.heading;
        summary.number = frame.record.number;
      }
      if (frame.tag.local === 'note' && frame.attributes.role === 'crossHeading' && parent?.tag.local === 'notes') {
        parent.noteGroup = frame.attributes.topic ?? null;
      }
    }
    if (frame.record) {
      if (frame.tag.local === 'ref') frame.record.text = text;
      emit(frame.record);
    }
  });
  return {
    write: text => parser.write(text),
    finish: () => { parser.close(); return summary; },
  };
}
