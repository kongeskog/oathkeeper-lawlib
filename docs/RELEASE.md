# Legal-library developer releases

## 0.1.0-dev.4 — constitutional inventory and authority

Adds 137 provision units from the three already pinned National Archives
transcripts, 37 scoped authority/history relationships, and 10 institutional
actors or classes. Original text, editorial notes and executable coverage remain
distinct. The original documents remain external; derived text and typed `.oath`
records reproduce through a hash-checked, snapshot-specific extractor.

Three new queries check the ordinary-bill signature path, congressional proposal
arithmetic and conditional modern Article V ratification requirements. 48 new
authority fixtures plus four direct Amendment XX power fixtures bring the library
to 191 fixtures across eight packages and 30 modules. Every passing semantic
fixture receives an independent certificate check. Five inventory integrity and
linkage tests cover source/digest alterations, historical preservation, query
links and generated records. No language-kernel changes are needed.

New records extend the jurisdiction-neutral legal library. Dependent package
locks were explicitly refreshed; historical releases remain available. All legal
review remains Unreviewed. No new comprehensive constitutional doctrine, actual
enactment history, or complete source-authority chain is claimed.

## 0.1.0-dev.3 — source-to-encoding workflow

Adds provision text extraction for two pinned OLRC releases, a shared CLI/browser
draft renderer, and explicit source/encoding/test links with release comparison.
67,680 source units per release retain body text, notes, credits and references.
Original documents and large derived shards remain external to Git.

The real comparison finds six uniquely located changes and 57 document groups
requiring identity review. An earlier-release commerce draft is correctly affected
and remains unresolved. Synthetic tests exercise dependent-encoding impact.
No textual diff creates an enactment, repeal, or effective date.

Adds a W.D. Washington ordinary answer-service profile: 33 authored fixtures cover
2026 holidays, procedural exclusions and unresolved findings. Eight packages now
contain 139 fixtures, including one deliberately unimplemented draft. All legal
review statuses remain Unreviewed. The Rust implementation and candidate pin are
unchanged. Source byte audits cover 17 unique references.

The source workflow, comparison limitations and court review questions are in
`docs/SOURCE-WORKFLOW.md` and the new court package README. Hosted CI still requires
the configured OATHKEEPER_REPOSITORY repository variable; local checks do not claim
that remote CI has run.

## 0.1.0-dev.2 — source inventory and procedural computation

Adds the pinned OLRC 119-121 U.S. Code source inventory and an offline streaming
importer. All 58 XML documents reproduce with identical original and derived
hashes. The index preserves source structure, note classifications and references;
it creates no executable rules and claims no collection beyond the supplied Code.

Adds `us.federal.procedure.frcp.6`, a conditional forward whole-day Rule 6(a)
date model with explicit holiday/accessibility findings and 40 semantic fixtures.
Six packages now contain 105 fixtures. Every successful fixture is independently
certificate-checked. The language kernel and existing package sources are
unchanged; `compatibility.json` still identifies the tested Rust candidate.

The new encoding is **Unreviewed**. Its review packet is ready for assessment;
no lawyer review has occurred. The dated cache audit now covers 14 unique source
references. Original public documents and large derived indexes stay external.
Prior releases, sources and pins are preserved. General ingestion of all law,
reference resolution, citator coverage and amendment impact analysis are not
delivered by this milestone.

## 0.1.0-dev.1 — initial foundation

The five packages are runnable developer examples with complete local scenario
fixtures. Their review status is Unreviewed. No test or hash audit is a substitute
for legal review. The long-term aim is representing entire legal systems; this
release establishes mechanisms and limited examples.

The initial public source set consists of National Archives transcripts, the
identified Thornton reproduction, a Library of Congress Supreme Court report,
the Ninth Circuit decisions page, 2024 codified statutory sections, and dated
2025 IRS forms/instructions plus the 2025 limitation notice. Only source references
and hashes are committed. Original public-document bytes remain in an optional
external cache. The fictional household policy is a local fixture.

The IRA package's 2024 statutory baseline and limited reconciliation are explicit
coverage limitations. Other current-year contribution amounts can be assessed
for the contribution cap but are excluded from conversion basis allocation.
This is not a complete current-law legal opinion.

Source-map coverage of all constitutional Articles/Amendments is separate from
the small executable subset. Authority and treatment fixtures include clearly
labeled synthetic premises. No actual later treatment of Thornton is invented.

Future releases should preserve historical sources and revisions, record whether
a change is a legal amendment or encoding correction, and identify affected
dependents through oath.lock. A general dependency impact-report command remains
future maintenance work.

Hosted CI uses the exact candidate revision in compatibility.json from
`kongeskog/oathkeeper`; the repository variable OATHKEEPER_REPOSITORY can override
that location for forks. Source fetching is confined to a
separate manually invoked audit workflow, so availability or website changes do
not make computational tests nondeterministic.
