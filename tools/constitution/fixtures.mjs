// Authored expected outcomes. No interpreter output is used to generate expectations.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from './build.mjs';
const known = value => ({ state: 'known', value, evidence: ['synthetic:constitutional-authority-fixture'] });
const bool = value => known({ type: 'bool', value });
const int = value => known({ type: 'int', value: String(value) });
const record = (name, fields) => known({ type: 'record', name, type_args: [], fields });
const mode = variant => known({ type: 'variant', name: 'us.constitution.authority.RatificationMode', type_args: [], variant, fields: [] });
const date = iso => record('std.date.Date', { day: int(Date.parse(iso + 'T00:00:00Z') / 86400000) });
const missing = id => ({ state: 'missing', issues: [{ id, kind: 'Fact', message: 'Required accepted finding has not been supplied' }] });
const dispute = id => ({ state: 'disputed', issue: id, claims: [{ value: { type: 'bool', value: true }, evidence: ['synthetic:A'] }, { value: { type: 'bool', value: false }, evidence: ['synthetic:B'] }] });
let count = 0;
async function fixture(name, query, args, expected) {
  const value = { name: `authority_${name}`, request: { version: '0.1.0', query: query.startsWith('us.') ? query : `us.constitution.authority.${query}`, arguments: args, metadata: { scenario_kind: 'Synthetic; no historical enactment or ratification asserted' } }, expected: { kind: 'outcome', status: typeof expected === 'boolean' ? 'resolved' : expected, ...(typeof expected === 'boolean' ? { value: { type: 'bool', value: expected } } : {}) } };
  await writeFile(join(root, 'us/federal/constitution/tests', value.name + '.json'), JSON.stringify(value, null, 2) + '\n');
  count++;
}
const signature = Object.fromEntries(['ordinary_bill', 'procedural_inventory_complete', 'article_i_section_seven_applies', 'valid_house_passage', 'valid_senate_passage', 'identical_text', 'presented_to_president', 'signed_by_president', 'signature_timing_valid', 'originated_in_house'].map(k => [k, bool(true)]));
signature.revenue_bill = bool(false);
async function signed(name, changes, expected) { await fixture(name, 'signed_bill_path_requirements', { facts: record('us.constitution.authority.SignedBillFacts', { ...signature, ...changes }) }, expected); }
await signed('signed_bill', {}, true);
await signed('revenue_house_origin', { revenue_bill: bool(true) }, true);
await signed('revenue_senate_origin', { revenue_bill: bool(true), originated_in_house: bool(false) }, false);
await signed('nonrevenue_senate_origin', { originated_in_house: bool(false) }, true);
await signed('unknown_revenue_classification', { revenue_bill: missing('bill.classification'), originated_in_house: bool(false) }, 'undetermined');
await signed('irrelevant_origin_unknown', { originated_in_house: missing('bill.origin') }, true);
for (const key of ['valid_house_passage', 'valid_senate_passage', 'identical_text', 'presented_to_president', 'signed_by_president']) await signed('missing_requirement_' + key, { [key]: bool(false) }, false);
await signed('disputed_signature', { signed_by_president: dispute('bill.signature') }, 'undetermined');
await signed('signature_timing_failed', { signature_timing_valid: bool(false) }, false);
await signed('signature_timing_unresolved', { signature_timing_valid: missing('bill.signature.timing') }, 'undetermined');
await signed('unknown_passage', { valid_senate_passage: missing('senate.passage') }, 'undetermined');
await signed('known_failure_decides', { valid_house_passage: bool(false), signed_by_president: missing('bill.signature') }, false);
await signed('other_instrument', { ordinary_bill: bool(false) }, 'outside_coverage');
await signed('incomplete_procedure', { procedural_inventory_complete: bool(false) }, 'outside_coverage');
await signed('unknown_inventory', { procedural_inventory_complete: missing('procedure.inventory') }, 'undetermined');
await signed('signature_path_inapplicable', { article_i_section_seven_applies: bool(false) }, 'inapplicable');
const vote = (yes, denominator, complete = true) => record('us.constitution.text.Vote', { affirmative: int(yes), denominator: int(denominator), inventory_complete: bool(complete) });
for (const [name, house, senate, outcome] of [
  ['proposal_boundary', vote(2,3), vote(2,3), true],
  ['proposal_house_short', vote(1,3), vote(2,3), false],
  ['proposal_senate_short', vote(2,3), vote(1,3), false],
  ['proposal_fraction_below', vote(3,5), vote(2,3), false],
  ['proposal_fraction_above', vote(4,5), vote(2,3), true],
  ['proposal_zero_denominator', vote(0,0), vote(2,3), 'outside_coverage'],
  ['proposal_excess_votes', vote(4,3), vote(2,3), 'outside_coverage'],
  ['proposal_incomplete_tally', vote(2,3,false), vote(2,3), 'outside_coverage'],
  ['proposal_unknown_vote', missing('house.tally'), vote(2,3), 'undetermined'],
]) await fixture(name, 'congressional_proposal_numeric_threshold', { house, senate }, outcome);
const ratification = {
  assessment_on: date('2026-10-19'), article_v_governs: bool(true), state_inventory_complete: bool(true), number_of_states: int(50), ratifying_states: int(38), valid_proposal: bool(true), congress_selected_mode: mode('Legislatures'), counted_mode: mode('Legislatures'), counted_ratifications_valid: bool(true), applicable_timing_requirements_satisfied: bool(true), deprives_state_equal_senate_suffrage: bool(false), affected_state_consent_established: bool(false),
};
async function ratify(name, changes, expected) { await fixture(name, 'modern_ratification_requirements', { facts: record('us.constitution.authority.RatificationFacts', { ...ratification, ...changes }) }, expected); }
await ratify('ratification_38', {}, true);
await ratify('ratification_37', { ratifying_states: int(37) }, false);
await ratify('ratification_mode_mismatch', { counted_mode: mode('Conventions') }, false);
await ratify('ratification_conventions', { counted_mode: mode('Conventions'), congress_selected_mode: mode('Conventions') }, true);
await ratify('ratification_invalid_proposal', { valid_proposal: bool(false) }, false);
await ratify('ratification_invalid_votes', { counted_ratifications_valid: bool(false) }, false);
await ratify('ratification_timing_failed', { applicable_timing_requirements_satisfied: bool(false) }, false);
await ratify('ratification_timing_unresolved', { applicable_timing_requirements_satisfied: missing('article-v.timing') }, 'undetermined');
await ratify('ratification_disputed_validity', { counted_ratifications_valid: dispute('article-v.ratifications') }, 'undetermined');
await ratify('equal_suffrage_no_consent', { deprives_state_equal_senate_suffrage: bool(true) }, false);
await ratify('equal_suffrage_consent', { deprives_state_equal_senate_suffrage: bool(true), affected_state_consent_established: bool(true) }, true);
await ratify('equal_suffrage_consent_missing', { deprives_state_equal_senate_suffrage: bool(true), affected_state_consent_established: missing('state.consent') }, 'undetermined');
await ratify('irrelevant_consent_missing', { affected_state_consent_established: missing('state.consent') }, true);
await ratify('historical_proviso_excluded', { assessment_on: date('1807-12-31') }, 'outside_coverage');
await ratify('modern_profile_boundary', { assessment_on: date('1808-01-01') }, true);
await ratify('ratification_incomplete_inventory', { state_inventory_complete: bool(false) }, 'outside_coverage');
await ratify('ratification_unknown_inventory', { state_inventory_complete: missing('states.inventory') }, 'undetermined');
await ratify('ratification_zero_states', { number_of_states: int(0) }, 'outside_coverage');
await ratify('ratification_inapplicable', { article_v_governs: bool(false) }, 'inapplicable');
for (const [name, on, context, outcome] of [
  ['succession_before_ratification', '1933-01-22', bool(true), 'inapplicable'],
  ['succession_at_ratification', '1933-01-23', bool(true), true],
  ['succession_different_context', '1933-01-23', bool(false), false],
  ['succession_unknown_context', '1933-01-23', missing('succession.context'), 'undetermined'],
]) await fixture(name, 'us.constitution.text.succession_legislation_context', { on: date(on), specified_contingent_choice: context }, outcome);
console.log(`Wrote ${count} authored authority fixtures.`);
