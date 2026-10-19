# Legal review packet — pending

Status: **Unreviewed**. No qualified legal reviewer has assessed this package.
Computational tests and source-byte checks do not change that status.

Review target: package `us.federal.procedure.frcp.6` 0.1.0;
package digest `52067918617a4b5b0ab1e8c4fb1577d0a55fd8cde98e8db9bbf293903647ef95`;
program digest `975cc4891736363ac56df5ef78b47a0938aecc8416cba0353b74743dd20c5111`.
These bind code and dependencies, not fixtures. Review the fixture files and
their rationale at the same Git revision and record that revision in any review.

Primary source: [official FRCP compilation](https://www.uscourts.gov/sites/default/files/document/federal-rules-of-civil-procedure.pdf),
December 1, 2025 text, Rule 6(a), printed pages 12–13 (PDF pages 31–32).
The raw PDF SHA-256 is pinned in `src/sources.oath`. The PDF URL is mutable;
use preserved bytes or re-audit before reviewing a different download.

| Encoded mechanism | Source | Implementation | Boundary to assess |
|---|---|---|---|
| Exclude triggering day; count intermediate dates | 6(a)(1)(A)–(B) | `add_days(trigger, period_days)` | Positive whole-day periods |
| Weekend/holiday endpoint | 6(a)(1)(C) | `weekend`, `holiday`, `visit_day` | Holiday classifications are supplied |
| Clerk inaccessibility for filing | 6(a)(3)(A) | `requires_filing`, `clerk_accessible` | Relevant filing method; modifying orders excluded |
| Forward adjustment | 6(a)(5) | Consecutive ascending dates | Before-event cases rejected |
| Holiday categories | 6(a)(6)(A)–(C) | Three separate Boolean findings | State declarations within this after-event profile |
| Other adjustments | 6(b)–(d), other authorities | Scope finding | Adequacy of exclusions and unknown-fact propagation |

Review questions:

1. Does the algorithm correctly implement this narrow conditional reading,
   including endpoint holidays and clerk inaccessibility?
2. Are inputs and assumptions sufficient to distinguish computation from
   deciding an actual deadline or timeliness?
3. Which authorities, local rules, orders and interpretations must be researched
   before supporting one real district court and proceeding type?
4. Should any finding be decomposed to expose a material legal question,
   particularly `no_other_adjustments`?
5. Independently assess every expected outcome in `fixtures.mjs`; add cited
   counterexamples. Dates/declarations are synthetic, not actual court closures.
6. Assess historical applicability before enabling a historical profile. A
   selected compilation and a scenario date do not establish it.

Record reviewer identity and qualifications, date, exact code/fixture revision,
scope, authorities considered, disagreements, and unresolved interpretations.
A review must name what it assessed; do not upgrade every source or question
because one algorithm was reviewed. Preserve this pending packet as history.
Attach a ReviewRecord to a future encoding revision only after an actual review.
