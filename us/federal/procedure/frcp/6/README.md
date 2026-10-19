# Rule 6(a): a conditional deadline date

`us.frcp.r6.deadline_date` computes a civil date for a period stated in
**1–366 whole days after an event**, using Rule 6(a) in the pinned December 1,
2025 compilation. Legal review: **Unreviewed**.

The package excludes the trigger day, counts every intermediate day, and moves
a weekend/holiday endpoint forward. For filing, it also moves past supplied
clerk-inaccessibility findings. The calendar contains 1–31 consecutive dates
starting at the unadjusted endpoint. Its court and state must match the request.
Once an eligible date is established, unknown holiday/accessibility fields on
later days are irrelevant; the date sequence is still structurally checked.

Holiday classification is supplied separately for statutory observance days,
presidential/congressional declarations, and state declarations. Known false is
an explicit finding. The completeness flag is a premise, not an engine claim
that all holidays were discovered. Neither a court ID nor an evidence label
authenticates a decision-maker.

The caller supplies whether Rule 6 and this text apply, the trigger and period,
filing status, and whether other adjustments affect the calculation.
`no_other_adjustments` covers service additions under Rule 6(d), discretionary
extensions, tolling, special statutory counting methods and modifying court
orders. An unknown finding remains unknown. A known unsupported adjustment
returns OutsideCoverage. False Rule 6 applicability returns Inapplicable when
the scenario otherwise fits the supported profile.

No eligible date in the supplied window yields **Undetermined**, stage
`selection`, issue kind `NoSupportingRule`. The window can be extended up to
31 dates; the engine does not infer missing later dates or invent a deadline.
Malformed/nonconsecutive calendars and known incomplete holiday findings are
OutsideCoverage, rather than a legal conclusion about the underlying deadline.

This package does not decide hours, months, years, periods before an event,
filing cutoff times, time zones, service validity, actual timeliness, or remedies.
It does not resolve whether an electronic outage constitutes clerk
inaccessibility. It applies an explicit conditional model, not automatically
the law in force on the scenario date. The compilation date is not a claim that
Rule 6 commenced on that date. Historical and future applicability remain
supplied findings; the 2028 leap-day fixture is explicitly conditional.

From the lawlib repository:

```powershell
../oathkeeper/target/debug/oath.exe test us/federal/procedure/frcp/6
../oathkeeper/target/debug/oath.exe run us/federal/procedure/frcp/6 --request us/federal/procedure/frcp/6/scenarios/closure-and-holiday.json --certificate deadline.cert.json --format json
../oathkeeper/target/debug/oath.exe verify us/federal/procedure/frcp/6 --request us/federal/procedure/frcp/6/scenarios/closure-and-holiday.json --certificate deadline.cert.json
```

The scenario expects March 10, 2026, conditional on a synthetic Friday closure
and Monday state holiday. It makes no claim about a real court.
`fixtures.mjs` contains 40 independently selected expected outcomes with their
reasoning and generates the checked-in protocol fixtures. It is authoring
tooling, not another legal evaluator. The test harness runs every result through
the independent checker. See [the review packet](REVIEW.md).
