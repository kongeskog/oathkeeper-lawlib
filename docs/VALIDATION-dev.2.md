# Validation — 2026-10-19

- Windows GNU Oathkeeper candidate: all six packages compile and all **105**
  fixtures pass with independent certificate verification (40 new Rule 6 cases).
- WSL Ubuntu: all 40 Rule 6 fixtures also pass using the existing Linux candidate.
- Rule 6 scenario serialized to a certificate and independently verified through
  the CLI, offline with no source cache argument: March 10, 2026, day index 20522.
- Source audit: 14 unique SourceRef records match preserved original bytes;
  results in `source-audit.2026-10-19.json`. This is a cache audit, not a claim
  that mutable source URLs still serve those bytes.
- US Code all-titles archive: exact size and SHA-256 matched the committed pin.
  All 58 XML documents indexed. Independent offline replay matched the complete
  manifest and every XML/JSONL digest. Originals/indexes remain external.
- Inventory tooling: six tests pass for hierarchy, notes, repeated locators,
  nested headings, malformed input, DTD/namespace rejection, bounds, ZIP entry
  paths and source-digest mismatch. pnpm production audit: no known advisories
  reported at validation time. Dependencies pinned in the lockfile.
- No compiler/interpreter/checker changes were required. Hosted CI is configured
  but has not run for this local release. Human legal review is pending.

Reproduce computational checks with `scripts/test.ps1` and importer unit tests
with `pnpm test` in `tools/inventory`. Full-source replay needs the separately
available original archive; network availability is not part of computational CI.
