# Contributing to lawlib

Contributions and reviews are open to everyone. Legal expertise is welcome; professional status is not a gate. Distinguish what you checked from what you assume. Never approve on another person's behalf.

1. Choose a bounded question and identify the source editions, forum and relevant dates.
2. Edit canonical `.oath` code under the jurisdiction tree (currently `us/`). Only `.oath` and `README.md` belong there. Write explanatory `///` comments directly above each rule. Add new evidence to the root `sources.lock.json` once; register a new module entrypoint in `oath-package.json`. Include a coverage contract, exclusions and known omissions. Keep missing evidence explicit.
3. Map every premise and conclusion to a source passage and an interpretation note. Explain exceptions, alternative readings, procedural limits and authority treatment. Changes in legal interpretation need their own rationale.
4. Record Seattle case expectations in `tests/expectations.json` so adding or dropping a case cannot silently change the regression baseline. Include reproducible cases, boundaries, missing evidence, contrary evidence and scope failures. Real-case reconstructions remain `.case.oath` alongside their legal modules. Put synthetic JSON inputs in `tests/scenarios/` and declare the module's scenario directory in `oath-package.json`. Preserve the distinction between a judicial finding supplied as input and an independently established fact.
5. Run `python tools/check.py --fetch` and `python tools/build.py --check`. Submit authored inputs only. CI builds compiled JSON, proof reports and review packets into `.build/` and attaches them to the run. Do not commit generated output or source-document bytes.
6. Request community review of the exact artifact digest. Authors can explain their own work; they cannot label it an independent review.

A merge records a contribution; it does not certify legal correctness. Drafts remain usable as explicitly unreviewed models. A review records an individual's assessment of a named aspect and exact snapshot, not a universal approval of every legal use.

Source materials need recorded provenance and rights. Publish exact bytes to an HTTPS artifact mirror and add their SHA-256, size, media type, original URI, retrieval time and mirror URLs to the shared root `sources.lock.json`. Import local bytes with `python tools/sources.py import --source ID --file /path/to/document.pdf`; the tool refuses a hash mismatch. See [storage](docs/STORAGE.md). Do not add private client records or secrets. Original contributions are Apache-2.0; source material keeps its own rights.

## Rule documentation

Use ordinary wrapped `///` paragraphs immediately above a rule. The build uses the compiler's source locations to associate documentation with that rule, including imported rules. Optional `Scope:`, `Omitted:` (repeatable) and `Alternative readings:` paragraphs organize the generated review packet. Citations, versions and premises come from the rule itself; do not duplicate them in comments.

Comments are documentation, not executable conditions. Put any condition needed for a proof in a `requires` clause or coverage contract. Editing comments changes the pinned source graph and the community review digest, even when compiled rule semantics remain unchanged. Missing comments are displayed as missing documentation, never as an approved interpretation.
