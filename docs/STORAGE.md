# Source, builds and evidence

The repository contains what contributors author. Reviewable changes should show a changed legal premise, citation, interpretation or test input, without thousands of generated lines or a PDF replacement.

```text
us/                       .oath rules and real cases; module READMEs
sources.lock.json         shared evidence catalog (hashes, provenance, mirrors)
tests/scenarios/us/        synthetic JSON inputs
community/                signed review events and trusted public keys
tools/                    compiler, audit and evidence-cache commands
tests/                    storage and reproducibility regression tests
oath-package.json         entrypoints, package and exact engine version
.build/                   generated JSON, proofs and review packets (ignored)
```

Legal-source directories contain only `.oath` files and `README.md`. Interpretation explanations are `///` comments next to rules; checked scope is declared in `.oath` coverage contracts. The manifest lists entrypoints and optional synthetic scenario directories. Rule inventories, premise mappings and review packets are generated from source. Case regression expectations belong in `tests/expectations.json`, not in a parallel legal coverage manifest.


## Generated artifacts

Install the Python binding for the exact `engine_version` in `oath-package.json`. Run `python tools/build.py`. Compilation uses local `.oath` inputs and never downloads evidence. The output mirrors the source paths under `.build/`; `build-manifest.json` records every authored input hash, every output hash, the engine version and the evidence digests. It explicitly reports that compilation did not inspect the evidence bytes.

`python tools/build.py --check` independently rebuilds and compares all output bytes, detecting stale or edited products. Paths, build timestamps and machine timings do not enter the artifacts. `python tools/build.py --archive /tmp/oathkeeper-lawlib.tar.gz` produces a reproducible release archive. CI attaches this directory to each successful validation run; release archives are published separately from Git source.

Authored JSON is limited to package/evidence configuration, test inputs and actual community review records. CI rejects JSON or other non-source files in jurisdiction directories, unsafe scenario declarations, compiled exports, PDFs, archives and files larger than 1 MiB in the authored tree.

## Evidence objects

Each entry in the root `sources.lock.json` pins a SHA-256 digest, exact byte count, media type, logical filename, original provenance and HTTPS mirrors serving those exact bytes. `file` is a display/export name, not a path to a tracked file. The `uri` remains the cited authority; a storage mirror never becomes legal authority.

The existing nine snapshots are archived as individual assets in the [evidence-2026-10 release](https://github.com/kongeskog/oathkeeper-lawlib/releases/tag/evidence-2026-10), named `<sha256>.pdf` or `<sha256>.txt`. Original PDFs and the previously extracted Long text retain their original bytes and recorded rights. The cache layout is:

```text
$OATHKEEPER_CACHE_DIR/sha256/<first-two-hex>/<full-sha256>
```

The default is `$XDG_CACHE_HOME/oathkeeper`, or `~/.cache/oathkeeper`. Different modules and checkouts reuse the same object. Fetching one module does not download the whole corpus:

```sh
python tools/sources.py list --module seattle
python tools/sources.py fetch --module seattle
python tools/sources.py fetch --source shank2018
python tools/sources.py verify              # cached bytes only; never network
python tools/check.py --fetch               # explicit full evidence audit
python tools/check.py                       # repeat the audit offline
```

Every cache read checks size and hash again. Downloads stream to temporary files and enter the cache only after verification; truncated, oversized, changed or unavailable evidence fails visibly. The default per-object download limit is 128 MiB, configurable with `--max-bytes`. A corrupt cache object is rejected; remove that object explicitly before refetching. Missing evidence does not invalidate a conditional derivation, but it prevents reporting a successful evidence audit.

For offline environments, copy the cache or use `sources.py import --source ID --file /path/to/snapshot.pdf`. Imports perform the same checks. To change storage providers, add exact-byte HTTPS mirrors (for example object storage or an institutional archive). No Git LFS service or specific cloud SDK is required. Hashes identify bytes, not authenticity or legal correctness. Keep more than one independently operated mirror when possible; an artifact host can still become unavailable.

## Releases and history

New documents are uploaded as new content-addressed assets; never replace an existing asset to represent an amendment. New editions receive new hashes and explicit provenance. Do not run `gh release upload --clobber` on evidence. Preserve original rights and do not publish private records.

Version 0.1.0 and its historical Git objects remain intact because released software pins that exact revision. Version 0.2.0 removes generated products and source documents from the current source tree and stops that growth. Version 0.2.1 separates authored metadata and synthetic inputs from legal code without changing any `.oath` bytes or evidence digests. Version 0.3.0 consolidates interpretation prose into `.oath` comments, shares one evidence catalog, and derives inventories and review views. Historical pilot material is ordinary documentation. A shallow clone or a GitHub source archive downloads only the current authored snapshot. Rewriting historical tags would break existing revision pins and is not part of this migration.

## Software dependency

The software repository keeps `lawlib.lock.json`, not a second copy of this source tree. Its `python tools/lawlib_package.py sync` command fetches the exact commit into ignored `.deps/lawlib/` and verifies the complete SHA-256 inventory. A prepared checkout builds offline. Corpus changes enter software only through an explicit lockfile update and replay.
