# lawlib

lawlib is the separate repository of legal programs for
[Oathkeeper](../oathkeeper/README.md). It provides jurisdiction-neutral records,
explicit authority relationships, historical revisions, source anchors and
scoped executable examples. All initial legal encodings are **Unreviewed**.

This is a foundation for representing legal systems, not an encoding of all US
law. Source mapping, executable coverage, byte integrity and legal review are
tracked separately.

## Packages

| Package | Executable coverage |
|---|---|
| `legal` | Shared legal records, lifecycle tests and an explicit deadline convention |
| `private/household/demo` | Membership/quiet hours, emergency findings, delayed commencement, amendment, notice deadline and no invented fine |
| `us/authority` | Narrow supplied court profiles; binding force, citation permission and persuasive relevance are separate questions |
| `us/federal/constitution` | Selected age/citizenship requirements, numeric thresholds, Amendment XX commencement and a narrow Thornton proposition |
| `us/federal/tax/ira/2025` | Ordinary same-year own-account contributions and conversions, exact basis allocation and selected Form 8606 reporting |
| `us/federal/procedure/frcp/6` | Conditional Rule 6(a) date computation with supplied calendar findings, weekends, holidays and clerk inaccessibility |
| `us/federal/courts/wawd/answer/2026` | Bounded ordinary answer-service date, 2026 holidays and concrete procedural exclusions |
| `drafts/us/federal/commerce/9801` | Unimplemented historical source-linked draft; its test requires an unresolved answer |

The Constitution source map covers all seven Articles and 27 Amendments.
The [federal source inventory](inventory/README.md) separately pins all 58 XML
documents in OLRC release 119-121. Imported source structure is not executable
coverage. See the [Rule 6 review packet](us/federal/procedure/frcp/6/REVIEW.md)
for the first procedural-law package and its pending legal review.

The [source-to-program workflow](docs/SOURCE-WORKFLOW.md) adds provision text,
draft authoring, and explicit source-change impact across releases 119-118 and
119-121. No import or diff creates an executable rule or legal effective date.

Only the named questions execute. Synthetic treatment/interpretation fixtures
are explicitly labeled and make no assertions about actual subsequent history.

Geographic paths organize navigation. A household has membership and location,
not an inherited place in a universal public-law authority tree. Authority,
scope, delegation and priority must be authored explicitly.

## Run the examples

Check out `oathkeeper` and `lawlib` as sibling directories. The candidate build
is pinned in `compatibility.json`; package manifests and locks also pin std and
language versions/content. Build Oathkeeper using its README.

From this repository, on PowerShell:

```powershell
./scripts/test.ps1
../oathkeeper/target/debug/oath.exe run us/federal/tax/ira/2025 --request us/federal/tax/ira/2025/scenarios/pro-rata-conversion.json --certificate ira.cert.json --format json
../oathkeeper/target/debug/oath.exe verify us/federal/tax/ira/2025 --request us/federal/tax/ira/2025/scenarios/pro-rata-conversion.json --certificate ira.cert.json
../oathkeeper/target/debug/oath.exe coverage us/federal/constitution --json
```

On Linux, use `../oathkeeper/target/debug/oath` with the same arguments.
`pwsh ./scripts/test.ps1` also runs on Linux; `packages.json` is the package
inventory for other runners. Do not regenerate locks merely to hide a mismatch:
review source/dependency changes, then explicitly run `oath lock PACKAGE`.

The IRA fixtures include $7,000 basis/$7,000 conversion with a $0 remaining
balance (taxable $0), and with $93,000 remaining (taxable $6,510). Queries also
cover prior basis, incomplete inventories, missing balances, unsupported
transactions and explicit rounding. There is no unrestricted legality Boolean.

## Source and review workflow

Source references live alongside code, with stable IDs, edition/version,
locators and SHA-256 of the original bytes. Public documents are not vendored.
The fictional household policy is an intentional local fixture. An external
cache may retain historical original bytes under their digest.

```sh
oath sources check us/federal/constitution --cache /path/to/cache
oath sources check us/federal/constitution --cache /path/to/cache --fetch
```

Only the second command permits network retrieval. Unavailable or changed bytes
are an audit failure, independently of computational verification. Source
references document what was inspected; later website edits can require access
to the preserved snapshot.

For each encoding, record sources, anchors, assumptions, supported scope,
uninvestigated questions and review status. Preserve historical provisions and
distinguish legal amendments from encoding corrections. Enactment dates do not
automatically determine commencement, retroactivity, repeal or applicable law.

Read [encoding conventions](docs/ENCODING.md), the [coverage matrix](docs/COVERAGE.md)
and [release notes](docs/RELEASE.md). Computational tests must never upgrade a
legal review status.
