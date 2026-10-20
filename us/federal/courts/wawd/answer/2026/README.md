# W.D. Washington: ordinary answer service in 2026

This package computes a **conditional date to serve an answer**, under the supplied
findings and selected authorities. It is legally **Unreviewed**. The fixtures are
hypothetical; the court, rules, and source documents are real.

## The question and its boundaries

`us.wawd.answer.answer_service_date` takes `AnswerFacts` and returns a `Date` or an
explicit unresolved, inapplicable, or unsupported outcome. It composes the existing
Rule 6 query. It does not decide actual timeliness, filing, default, liability,
or remedies. Rule 5(d)'s filing obligation is a separate question.

The supported facts are an ordinary original complaint, a private domestic
defendant, and valid personal Rule 4 service in the Western District of Washington.
Concrete inputs identify service waiver, removal, a served Rule 12 motion, amended
pleadings, a different statutory period, a modifying order, stay/tolling, and special
proceedings. Any of these takes the question outside this narrow profile; an unknown
relevant finding blocks an answer. Findings do not authenticate themselves.

The procedural inventory and applicability of the pinned authorities must be
affirmatively supplied. The result is conditional on that scenario snapshot;
later motions or orders require a new run. No docket discovery is performed.

## Source-to-code decisions

| Source | Encoded use |
|---|---|
| FRCP 12(a)(1)(A)(i) | 21-day period to **serve** the original-complaint answer |
| FRCP 6(a)(1), (6) | Exclude service day, count intermediate days, advance a weekend or legal-holiday endpoint |
| FRCP 6(a)(3) | Filing inaccessibility does not automatically adjust this service question |
| FRCP 6(d) | Personal Rule 4 service does not receive the specified Rule 5 service-method additions |
| FRCP 12(a)(1)(A)(ii), (2)-(4), 15(a)(3), 81(c) | Waivers, special defendants, motions, amendments and removal are explicit exclusions |
| LCR 6(a), 12(a), 15 | Local fixed-date/order, filing-system and amended-pleading issues are investigated but excluded from this ordinary-service profile |
| RCW 1.16.050(1), (5), (7) | Washington legal holidays and weekend observation; recognized days are not automatically legal holidays |

The 2026 holiday dates are authored values with explicit source mapping. Federal
holidays come from Rule 6(a)(6)(A), including October 12; state law adds November 27
and the July 3 observance. Sundays are independently excluded by the base Rule 6
model. Additional presidential/congressional and state declarations use separate
input lists with an explicit shared completeness finding. An empty list alone is
not evidence of completeness.

Service dates January 13 through December 4, 2026 are supported. This bounds the
seven-day endpoint search to the authored 2026 calendar. These bounds are package
coverage, **not a claim that the federal rule commenced or expired on those dates**.
The local-rule edition took effect January 13; the downloaded edition includes the
court's January 28 correction. Proposed later amendments are not treated as enacted.

## Run the example

From this package directory:

```sh
oath check .
oath test .
oath run . --request scenarios/thanksgiving-friday.json --format json --certificate answer.cert.json
oath verify . --request scenarios/thanksgiving-friday.json --certificate answer.cert.json
```

Hypothetical service November 6 produces November 30: day 21 is the Washington
holiday Friday November 27, followed by a weekend. The certificate checks that
calculation and the used premises. It does not authenticate the facts or certify
that all relevant law has been discovered.

33 authored fixtures include ordinary service, weekends, federal and Washington
holidays, a recognized nonholiday, no automatic three-day addition, profile date
boundaries, missing and disputed findings, and each procedural exclusion. Expected
dates are authored independently of the interpreter. Successful fixtures also
pass through the independent certificate checker.

## Legal review remains pending

Review the original source hashes and passages in `src/sources.oath`, the legal
classifications of holidays and service, applicability to the particular case,
and whether any unmodeled authority changes the answer. Comprehensive precedent,
judge-specific practices, individual dockets, and historical applicability have
not been investigated. Source audits and computational tests do not approve these
legal judgments. No human legal reviewer is recorded.
