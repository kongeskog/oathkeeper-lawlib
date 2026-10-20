# Constitutional inventory and authority

This package starts at the constitutional foundation: 137 provision units across
the Preamble, seven Articles and 27 Amendments, with 37 scoped relationships and
10 institutional actors or institutional classes. All legal review is **Unreviewed**.

The inventory preserves original constitutional wording, including historical
provisions, rather than silently presenting a consolidated current constitution.
An original-text entry is not a claim that it currently governs. Selected
amendment and repeal links explain changes without assigning a whole-clause
validity Boolean. The history and precedent inventory are not exhaustive.

## What is represented

The original Articles are divided into the conventional 84 clause/article units.
The Preamble is separate. Amendments use their numbered sections; unnumbered
Amendments XVII and XIX use explicitly editorial paragraph divisions. Other
unnumbered amendments remain whole. Attestation, signatures and unratified
proposals are excluded. There are 52 amendment units, not 52 amendments.

Each entry identifies its stable provision ID, source and locator, original
text, normalized-text digest, editorial title, analysis status, linked executable
questions, unresolved work and review status. Group IDs identify the original
Article or Amendment for navigation; they do not confer legal authority.

Analysis status concerns the encoding:

- **Represented:** source text and identity mapped; application not analyzed.
- **InterpretationRequired:** a specifically identified interpretive gap remains.
- **ExecutableSubset:** only the linked questions execute; other applications
  and interpretations remain uninvestigated.

These are not ratings of constitutional importance or legal validity.

## Authority relationships

`legal.model.AuthorityLink` is reused with explicit kinds: vesting, authorization,
restriction, procedure, reservation of powers, amendment and repeal. Each
relationship has a stated scope and source anchor. `legal.inventory.AuthorityRecord`
adds links to assessment queries, limitations and review status. The typed records
are in `src/structure.oath`; provisions are in `src/inventory.oath`.

Institutional classes such as state legislatures are expressly labeled classes.
Their presence does not authenticate a particular institution or event. State
powers are not modeled as an ordinary delegation from Congress. Article VI is
represented with its qualifications; no universal source rank or automatic
preemption algorithm is introduced. A descriptive relationship creates no rule
priority, and a path through the graph is not a proof of constitutional validity.

## Executable authority questions

| Query | Computation | Supplied or excluded matters |
|---|---|---|
| `us.constitution.authority.signed_bill_path_requirements` | Valid passage in both houses, same text, presentment, presidential signature and applicable revenue origination | Valid passage, authenticity, timing and classification are findings. Veto override and nonreturn are excluded. A false result concerns this path only. |
| `us.constitution.authority.congressional_proposal_numeric_threshold` | Exact two-thirds comparison in each house | Legally appropriate denominators are supplied. This query establishes neither quorum nor a valid proposed amendment. |
| `us.constitution.authority.modern_ratification_requirements` | Selected mode, three-fourths tally and supplied proposal, timing, validity and equal-suffrage conditions | Post-1808 profile only. State inventory, ratification validity, any deadline and any required consent are accepted findings. No certification or effective date is inferred. |

The ratification query invokes the existing numeric threshold query; it does not
duplicate its evaluator. Legislative and convention ratification modes remain
distinct. A convention that proposes an amendment is a different process and is
outside these executable questions. An unknown material deadline finding or
disputed signature produces `Undetermined`. A known incomplete inventory produces
`OutsideCoverage`. Known decisive facts can make unrelated unknowns irrelevant.

48 new synthetic authority fixtures and four direct Amendment XX power fixtures exercise these distinctions. They do not assert that an
actual bill was enacted or an actual proposed amendment was ratified. Existing
qualification, impeachment, Amendment XX and narrow Thornton examples remain.
No new precedent is invented; subsequent-history and doctrinal research remain
listed work. The authority model complements the separate `us.authority` court
profiles, and does not replace them with a geometric hierarchy.

## Run and independently verify

From a checkout with the companion Oathkeeper standard library at its locked path:

```sh
oath check us/federal/constitution
oath test us/federal/constitution
```

`oath test` runs the authored fixtures and independently checks every successful
certificate. To use `oath run`, put a fixture's `request` object in a separate
request JSON file; the whole fixture is not a run request.

```sh
oath run us/federal/constitution --request request.json --format json --certificate run.cert.json
oath verify us/federal/constitution --request request.json --certificate run.cert.json
```

## Reproduce the inventory

`inventory/constitution/provisions.json` is the generated browsing inventory;
`tools/constitution/structure.mjs` contains authored segmentation labels and
relationship assertions. The generator checks the exact three original document
hashes already recorded in `src/sources.oath`. HTML documents remain in an
optional external cache; neither execution nor verification opens them.

```sh
node tools/constitution/build.mjs --cache /absolute/source-cache
node tools/constitution/build.mjs --check
node --test tools/constitution/inventory.test.mjs
```

The extractor only supports these pinned HTML snapshots. It normalizes whitespace,
decodes entities and retains editorial amendment notes separately from provision
text. Paragraph counts fail closed when source structure changes. The derived
text digest is separate from the original document digest. Source availability,
source-byte auditing, computational verification and legal review are distinct.

## Next connected branch and review questions

The next branch can connect Article I section 8 clause 9 and Article III section 1
to the statutes establishing federal courts and authorizing procedural rules,
then to the existing FRCP and W.D. Washington examples. No such complete chain is
claimed in this release.

Before widening execution, review the passage and denominator premises, revenue
classification, Article V timing and recognition controversies, scope of equal
suffrage consent, institutional identifiers, amendment-effect scope, and relevant
precedent. Rights provisions and powers with open-textured scope remain represented
without an invented mechanical answer. A verified computation proves only what
follows under the selected encoding and supplied premises.
