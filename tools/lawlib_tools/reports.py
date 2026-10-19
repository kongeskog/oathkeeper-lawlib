"""Derived views of legal source. Nothing here is a second authoring format."""
import json
from pathlib import Path
from .runtime import compile_source, module_paths
from . import sources


def interpretations(compilation):
    """Read adjacent /// documentation using compiler-provided declaration spans.

    Comments explain the translation; they are not checked legal premises. The
    community review digest includes their text, separately from the kernel IR.
    """
    spans = {s['id']: s for s in compilation['source_map'] if s['kind'] == 'rule'}
    notes = []
    for rule in compilation['module']['rules']:
        span = spans[rule['id']]
        lines = Path(span['file']).read_text().splitlines()
        preceding = []
        index = span['line'] - 2
        while index >= 0 and lines[index].lstrip().startswith('///'):
            preceding.append(lines[index].lstrip()[3:].strip())
            index -= 1
        paragraphs = '\n'.join(reversed(preceding)).split('\n\n')
        # Fields are prose paragraphs; ordinary wrapped lines are joined.
        fields = {'interpretation': [], 'scope': [], 'alternative_readings': [], 'omitted_conditions': []}
        current = 'interpretation'
        for paragraph in paragraphs:
            for line in paragraph.splitlines():
                for label, field in [('Scope: ', 'scope'), ('Alternative readings: ', 'alternative_readings'), ('Omitted: ', 'omitted_conditions')]:
                    if line.startswith(label):
                        current = field
                        fields[field].append(line[len(label):])
                        break
                else:
                    if line:
                        if fields[current]: fields[current][-1] += ' ' + line
                        else: fields[current].append(line)
        notes.append({
            'rule': rule['id'], 'version': rule['version'],
            'source_pinpoint': rule['authority']['pinpoint'],
            'interpretation': ' '.join(fields['interpretation']) or 'No explanatory documentation supplied; inspect the rule and its cited authority.',
            'scope': ' '.join(fields['scope']) or 'See the explicit applicability premises and coverage contracts in this module.',
            'omitted_conditions': fields['omitted_conditions'],
            'alternative_readings': ' '.join(fields['alternative_readings']) or 'Alternative readings have not been independently catalogued.',
            'legal_review': 'See signed community review journal',
            'formalization_review': 'See signed community review journal',
            'premise_mapping': [{'claim': p, 'role': 'explicit applicability assumption' if p['atom'].startswith('scope.') else 'checked arithmetic' if p['atom'].startswith('oathkeeper.') else 'sourced or separately established premise',
                                 'review_question': 'Does this premise capture the cited requirement, with the correct matter, polarity, and qualifications?'} for p in rule['premises']],
        })
    return {'format': 'oathkeeper-interpretations/1', 'interpretations': notes}


def source_document(root, module_id):
    return {'format': 'oathkeeper.sources/2', 'sources': sources.catalog(root, [module_id])}


def coverage(root, module_id):
    entry = module_paths(root, module_id)['entrypoint']
    compiled = compile_source(entry)
    module = compiled['module']
    expectations = json.loads((root / 'tests/expectations.json').read_text()).get(module_id, {})
    declared = []
    for names in expectations.values():
        for name in names:
            path = entry.parent / name
            if not path.resolve().is_relative_to(entry.parent.resolve()) or path.is_symlink() or not path.is_file() or not name.endswith('.case.oath'):
                raise ValueError('unsafe or missing case expectation: ' + name)
            declared.append(path.resolve())
    actual = {p.resolve() for p in (entry.parent / 'cases').glob('*.case.oath')}
    if len(declared) != len(set(declared)) or set(declared) != actual:
        raise ValueError('case expectations must cover every case exactly once')
    contracts = module.get('coverage', [])
    return {
        'format': 'oathkeeper-coverage/3', 'module': entry.name,
        'rule_ids': [r['id'] for r in module['rules']],
        'coverage_complete': False, 'inventory_complete': False,
        'review_status': 'consult_signed_community_journal',
        'cases': expectations.get('cases', []),
        'pending_cases': expectations.get('pending_cases', []),
        'assessment_cases': expectations.get('assessment_cases', []),
        'not_formalized': sorted({s for c in contracts for s in c['exclusions'] + c['known_omissions']}),
        'limitations': ['Scope is declared in .oath coverage contracts. Completeness and legal fidelity are not established by proof replay.'],
        'completeness_denominator': None,
    }
