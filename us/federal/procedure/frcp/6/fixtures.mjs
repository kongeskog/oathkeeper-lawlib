// Fixture authoring only: expected dates are hand-selected below, not calculated
// by a second deadline evaluator. All court/calendar findings are synthetic.
import { mkdir, writeFile } from 'node:fs/promises';
const dir = import.meta.dirname;
const namespace = 'us.frcp.r6.model.';
const known = value => ({ state: 'known', value, evidence: [] });
const bool = value => known({ type: 'bool', value });
const int = value => known({ type: 'int', value: String(value) });
const text = value => known({ type: 'text', value });
const record = (name, fields) => known({ type: 'record', name, type_args: [], fields });
const dayIndex = iso => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
const dateIndex = day => record('std.date.Date', { day: int(day) });
const date = iso => dateIndex(dayIndex(iso));
const missing = id => ({ state: 'missing', issues: [{ id, kind: 'Fact', message: 'Required supplied finding is missing' }] });
const dispute = id => ({ state: 'disputed', issue: id, claims: [true, false].map(value => ({ value: { type: 'bool', value }, evidence: [`claim:${value}`] })) });
const outcome = (status, extra = {}) => ({ kind: 'outcome', status, ...extra });
const cases = [
  { id: 'ordinary', trigger: '2026-03-02', period: 1, expected: '2026-03-03', reason: 'Exclude Monday; one day ends Tuesday.' },
  { id: 'intermediate_weekend_counts', trigger: '2026-03-06', period: 3, expected: '2026-03-09', reason: 'Friday excluded; Saturday and Sunday count; Monday is day three.' },
  { id: 'saturday_endpoint', trigger: '2026-03-06', period: 1, expected: '2026-03-09', reason: 'Saturday endpoint advances through Sunday to Monday.' },
  { id: 'sunday_endpoint', trigger: '2026-03-06', period: 2, expected: '2026-03-09', reason: 'Sunday endpoint advances to Monday.' },
  { id: 'statutory_holiday', trigger: '2026-07-02', period: 1, expected: '2026-07-06', holidays: [['2026-07-03', 'statutory_observance']], reason: 'Supplied July 3 observance and weekend defer to Monday. Holiday classification is a premise.' },
  { id: 'presidential_holiday', trigger: '2026-03-02', period: 1, expected: '2026-03-04', holidays: [['2026-03-03', 'presidential_or_congressional_holiday']], reason: 'Fictional presidential declaration covers Tuesday.' },
  { id: 'state_holiday', trigger: '2026-03-02', period: 1, expected: '2026-03-04', holidays: [['2026-03-03', 'state_declared_holiday']], reason: 'Fictional state declaration counts for a period after an event.' },
  { id: 'inaccessible_endpoint', trigger: '2026-03-02', period: 1, expected: '2026-03-04', inaccessible: ['2026-03-03'], reason: 'Supplied filing inaccessibility extends Tuesday to accessible Wednesday.' },
  { id: 'closure_and_holiday', trigger: '2026-03-05', period: 1, expected: '2026-03-10', inaccessible: ['2026-03-06'], holidays: [['2026-03-09', 'state_declared_holiday']], reason: 'Friday inaccessible, weekend excluded as endpoints, Monday holiday; Tuesday first eligible.' },
  { id: 'nonfiling_ignores_clerk', trigger: '2026-03-02', period: 1, expected: '2026-03-03', inaccessible: ['2026-03-03'], fields: { requires_filing: bool(false) }, reason: 'Inaccessibility adjustment is for filing.' },
  { id: 'leap_day_counts', trigger: '2028-02-28', period: 2, expected: '2028-03-01', reason: 'Conditional future-text fixture: leap day is day one, March 1 day two; no prediction about 2028 law.' },
  { id: 'year_boundary', trigger: '2026-12-31', period: 1, expected: '2027-01-04', holidays: [['2027-01-01', 'statutory_observance']], reason: 'Supplied New Year observance followed by weekend.' },
  { id: 'maximum_period', trigger: '2026-03-02', period: 366, expected: '2027-03-03', reason: '366 days from nonleap March 2 reaches following March 3, a Wednesday.' },
  { id: 'long_month_boundary', trigger: '2026-01-31', period: 30, expected: '2026-03-02', reason: 'Thirty days, not one month; February has 28 days.' },
  { id: 'not_applicable', status: 'inapplicable', fields: { rule6_applies: bool(false) }, reason: 'Supplied legal applicability finding is false.' },
  { id: 'missing_trigger', status: 'undetermined', fields: { trigger: missing('trigger') }, reason: 'No guessed trigger date.' },
  { id: 'missing_applicability', status: 'undetermined', fields: { rule6_applies: missing('applicability') }, reason: 'No guessed authority applicability.' },
  { id: 'missing_adjustments_review', status: 'undetermined', fields: { no_other_adjustments: missing('adjustments') }, reason: 'Cannot assume no local, statutory, service or discretionary adjustments.' },
  { id: 'unsupported_adjustment', status: 'outside_coverage', fields: { no_other_adjustments: bool(false) }, reason: 'Additional adjustments require another model.' },
  { id: 'different_revision', status: 'outside_coverage', fields: { selected_text_applies: bool(false) }, reason: 'No automatic latest-text or retrospective application.' },
  { id: 'before_event_excluded', status: 'outside_coverage', fields: { measured_after_event: bool(false) }, reason: 'Backward computation is an explicit initial exclusion.' },
  { id: 'zero_period', period: 0, status: 'outside_coverage', reason: 'Only positive whole-day periods supported.' },
  { id: 'negative_period', period: -1, status: 'outside_coverage', reason: 'No implicit direction from negative numbers.' },
  { id: 'excessive_period', period: 367, status: 'outside_coverage', reason: 'Explicit profile bound.' },
  { id: 'incomplete_holidays', status: 'outside_coverage', calendar: { holiday_findings_complete: bool(false) }, reason: 'Known incomplete classification is outside the supported profile.' },
  { id: 'unknown_holiday_completeness', status: 'undetermined', calendar: { holiday_findings_complete: missing('holiday-completeness') }, reason: 'A list cannot establish its own completeness.' },
  { id: 'wrong_court_calendar', status: 'outside_coverage', calendar: { court_id: text('other-court') }, reason: 'Calendar must match the supplied court identity.' },
  { id: 'wrong_state_calendar', status: 'outside_coverage', calendar: { state_id: text('other-state') }, reason: 'State holiday findings must match the court state.' },
  { id: 'missing_holiday', status: 'undetermined', dayPatch: [0, 'statutory_observance', missing('holiday')], reason: 'Unknown endpoint holiday is relevant.' },
  { id: 'disputed_holiday', status: 'undetermined', dayPatch: [0, 'state_declared_holiday', dispute('holiday.disputed')], reason: 'Competing classifications remain disputed.' },
  { id: 'missing_accessibility', status: 'undetermined', dayPatch: [0, 'clerk_accessible', missing('accessibility')], reason: 'Unknown endpoint filing accessibility is relevant.' },
  { id: 'irrelevant_later_unknown', expected: '2026-03-03', dayPatch: [1, 'clerk_accessible', missing('later-accessibility')], reason: 'Later days are irrelevant after Tuesday resolves.' },
  { id: 'weekend_unknown_holiday', trigger: '2026-03-06', period: 1, expected: '2026-03-09', dayPatch: [0, 'statutory_observance', missing('weekend-holiday')], reason: 'Saturday is already excluded; its holiday classification is irrelevant.' },
  { id: 'calendar_gap', status: 'outside_coverage', dayPatch: [1, 'on', date('2026-03-05')], reason: 'Nonconsecutive calendar must not skip a potentially earlier date.' },
  { id: 'calendar_duplicate', status: 'outside_coverage', dayPatch: [1, 'on', date('2026-03-03')], reason: 'Duplicate dates do not establish complete coverage.' },
  { id: 'calendar_empty', status: 'outside_coverage', count: 0, reason: 'Known empty calendar cannot resolve an endpoint.' },
  { id: 'calendar_excessive', status: 'outside_coverage', count: 32, reason: 'At most 31 adjustment dates supported.' },
  { id: 'window_exhausted', trigger: '2026-03-06', period: 1, count: 2, status: 'undetermined', reason: 'Only Saturday and Sunday supplied: no supporting rule, no invented Monday.' },
  { id: 'maximum_window', count: 31, inaccessiblePrefix: 30, expected: '2026-04-02', reason: 'Thirty consecutive inaccessible dates starting March 3; April 2 is the first accessible date and a Thursday.' },
  { id: 'maximum_window_exhausted', count: 31, inaccessiblePrefix: 31, status: 'undetermined', reason: 'The entire bounded window is inaccessible; no date is inferred beyond it.' },
];
await mkdir(`${dir}/tests`, { recursive: true });
await mkdir(`${dir}/scenarios`, { recursive: true });
for (const c of cases) {
  const trigger = c.trigger ?? '2026-03-02'; const period = c.period ?? 1;
  const days = Array.from({ length: c.count ?? 7 }, (_, i) => {
    const on = dayIndex(trigger) + period + i;
    const iso = new Date(on * 86400000).toISOString().slice(0, 10);
    const fields = { on: dateIndex(on), statutory_observance: bool(false), presidential_or_congressional_holiday: bool(false), state_declared_holiday: bool(false), clerk_accessible: bool(!(c.inaccessible ?? []).includes(iso)) };
    if (i < (c.inaccessiblePrefix ?? 0)) fields.clerk_accessible = bool(false);
    for (const [holiday, kind] of c.holidays ?? []) if (holiday === iso) fields[kind] = bool(true);
    if (c.dayPatch?.[0] === i) fields[c.dayPatch[1]] = c.dayPatch[2];
    return record(namespace + 'DayFinding', fields);
  });
  const fields = {
    court_id: text('synthetic:us-district-court'), state_id: text('synthetic:state'),
    trigger: date(trigger), period_days: int(period), measured_after_event: bool(true),
    rule6_applies: bool(true), selected_text_applies: bool(true), requires_filing: bool(true), no_other_adjustments: bool(true),
    calendar: record(namespace + 'Calendar', { court_id: text('synthetic:us-district-court'), state_id: text('synthetic:state'), holiday_findings_complete: bool(true), days: known({ type: 'list', items: days }), ...c.calendar }),
    ...c.fields,
  };
  const request = { version: '0.1.0', query: 'us.frcp.r6.deadline_date', arguments: { facts: record(namespace + 'DeadlineFacts', fields) }, metadata: { fixture_kind: 'Synthetic conditional legal premises', expected_reason: c.reason, legal_review: 'Unreviewed' } };
  const expected = c.expected ? outcome('resolved', { value: date(c.expected).value }) : outcome(c.status);
  const unresolved = {
    missing_trigger: ['scope', 'trigger'], missing_applicability: ['applicability', 'applicability'],
    missing_adjustments_review: ['scope', 'adjustments'], unknown_holiday_completeness: ['scope', 'holiday-completeness'],
    missing_holiday: ['rule_condition', 'holiday'], disputed_holiday: ['rule_condition', 'holiday.disputed'],
    missing_accessibility: ['rule_condition', 'accessibility'], window_exhausted: ['selection', 'us.frcp.r6.deadline_date'],
    maximum_window_exhausted: ['selection', 'us.frcp.r6.deadline_date'],
  }[c.id];
  if (unresolved) { expected.stage = unresolved[0]; expected.issue_ids = [unresolved[1]]; }
  await writeFile(`${dir}/tests/${c.id}.json`, JSON.stringify({ name: c.id, request, expected }, null, 2) + '\n');
  if (c.id === 'closure_and_holiday') await writeFile(`${dir}/scenarios/closure-and-holiday.json`, JSON.stringify(request, null, 2) + '\n');
}
console.log(`Wrote ${cases.length} authored fixtures`);
