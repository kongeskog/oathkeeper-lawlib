# From pinned sources to verified programs

This workflow connects source passages, authored encodings, scenarios, certificates,
and changes between releases. It does not translate natural language into executable
law automatically. Legal review remains **Unreviewed**.

## Read and reproduce source passages

The provision extractor supports the pinned OLRC releases 119-118 and 119-121.
Each has 58 XML documents and 67,680 extracted source units. Units include sections,
court rules, compiled acts, reorganization plans, and standalone notes or credits.
Quoted sections stay inside their containing unit. Counts include omitted and
repealed material and are not counts of operative laws.

Original archives and generated text shards live outside Git. Small catalogs
under `inventory/usc/RELEASE/provisions.json` pin each original XML document and
compressed index. Indexes pin compressed text shards. The browser checks that
chain before displaying text. Extraction retains text, notes and their publisher
labels, source credits, hierarchy, and cross-references. It normalizes whitespace
and flattens markup; consult the original XML for layout, tables and typography.
No extracted rendition claims to replace the official document.

From the lawlib root, with Node 24 and the locked inventory dependencies installed:

```sh
pnpm --dir tools/inventory install --frozen-lockfile
node tools/inventory/extract-provisions.mjs inventory/usc/119-121/source.json /cache/usc-119-121.zip /cache/provisions-119-121
node tools/inventory/workflow.mjs show /cache/provisions-119-121 usc28a.xml 1515f8cf1e5b19e1b5e644cf
```

Output directories must be new. The extractor verifies the ZIP's expected size and
digest before writing, checks member paths and publication identities, and writes
the catalog only after successful extraction. Compare the generated catalog with
the tracked pin. Fetching is a separate explicit operation; this command is offline.

Publisher locators can collide: the supplied Civil Rules appendix has two distinct
units with a Rule 6 locator. A snapshot key selects an exact occurrence. Keys based
on source positions are not durable legal identities. A reference navigation match
is not a resolved authority relationship or dependency.

## Create an unimplemented draft

The web provision explorer previews a six-file draft bundle. The shared pure
renderer is also used by the CLI. It creates a SourceRef whose hash covers original
XML bytes, a source anchor, rationale and coverage placeholders, an empty query,
and a scenario whose expected outcome is Undetermined. It invents no legal rule.

```sh
node tools/inventory/workflow.mjs materialize oath-draft.json ../my-draft
```

Inspect the files and set the std dependency path before using the compiler.
Alternatively, create the same draft from a verified local extraction:

```sh
node tools/inventory/workflow.mjs scaffold /cache/provisions-119-121 usc28a.xml 1515f8cf1e5b19e1b5e644cf config.json ../my-draft
```

`config.json` supplies `packageName`, `moduleName`, `stdPath` and `question`.
The destination must not exist. Bundle materialization accepts only the fixed
draft filenames, bounded strings, and no executable commands.

## Author, test, and verify

Define the typed question and facts; investigate definitions, applicability,
exceptions, temporal provisions, other authorities, interpretation and remedies.
Write expected outcomes independently, including missing/disputed facts and excluded
scenarios. Replace the empty query with cited rules only when those decisions are
recorded. Keep review status and unresolved mechanisms explicit.

```sh
oath lock ../my-draft
oath check ../my-draft
oath test ../my-draft
oath run ../my-draft --request ../my-draft/scenarios/example.json --certificate draft.cert.json
oath verify ../my-draft --request ../my-draft/scenarios/example.json --certificate draft.cert.json
```

`test` compares authored expectations and independently checks successful runs.
The court example is documented in the W.D. Washington package README. It computes
an answer-service date, with narrower authority and procedural findings than the
general Rule 6 model. Its original sources are separate from this OLRC collection.

## Register dependencies and compare releases

Add the draft's `encoding.json` record to `inventory/encodings.json`, adjusting its
package path. Source links pin a release, document, exact occurrence, locator and
extracted content hash. `depends_on` lists encoding dependencies explicitly; `tests`
lists scenario fixtures that need reassessment. Other document sources remain
pinned in `.oath`; this first comparison tool compares only the USC collection.

```sh
node tools/inventory/workflow.mjs validate-links /cache/provisions-119-121 inventory/encodings.json .
node tools/inventory/workflow.mjs impact /cache/provisions-119-118 /cache/provisions-119-121 inventory/encodings.json impact.json
```

Validate every selected source snapshot, and run compiler tests separately.
The comparator distinguishes body, notes, credits, and references. It matches unique
locators conservatively, groups unlocated/ambiguous material for identity review,
and propagates affected status through registered dependencies. Renumbering is not
silently treated as legal identity, and textual removal is not declared a repeal.

The committed comparison has five changed and one added uniquely located passage,
plus 57 document groups requiring identity review. The earlier-release commerce
draft is affected; it remains unimplemented. The Rule 6 and Rule 12 source passages
are unchanged. This says nothing about unregistered law, cases, local rules or RCW
changes. Synthetic tests separately demonstrate propagation from a changed period
through a dependent answer query and its fixtures.

Preserve old source references, package locks and release snapshots. Reassessment
can produce an encoding correction, a new legal revision with explicit temporal
conditions, or no substantive change. These outcomes require authored decisions.
An automated diff supplies none of them.
