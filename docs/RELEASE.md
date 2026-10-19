# Initial 0.1.0 legal-library snapshot

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

Hosted CI uses the exact candidate revision in compatibility.json and requires
the repository variable OATHKEEPER_REPOSITORY. Source fetching is confined to a
separate manually invoked audit workflow, so availability or website changes do
not make computational tests nondeterministic.
