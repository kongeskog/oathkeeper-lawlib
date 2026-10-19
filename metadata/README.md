# Module metadata

Authored provenance, interpretation and review information lives here. The legal rules and real-case reconstructions live under [`us/`](../us/README.md); their `.oath` imports do not depend on metadata paths.

| Directory | Legal module | Metadata |
| --- | --- | --- |
| [`us/wa/seattle/`](us/wa/seattle/) | [Seattle / Long / Timbs](../us/wa/seattle/README.md) | Source lock, interpretation notes, coverage, pending review, pilot protocol and historical migration record |
| [`us/tax/`](us/tax/) | [2025 federal IRA / Shank](../us/tax/README.md) | Shared source lock and interpretation notes |

[`oath-package.json`](../oath-package.json) declares the files used by each module. Paths inside Seattle's coverage and pilot records referring to legal modules or cases are relative to the declared legal entrypoint's directory (`us/wa/seattle/`); `review_record` names the sibling metadata file. Source-lock `file` values are logical export names for evidence cached outside Git.

These files are authored inputs. Generated packets, import locks, compiler IR and proof reports belong in ignored `.build/`. Synthetic inputs belong in [`tests/scenarios/`](../tests/scenarios/README.md). See [storage](../docs/STORAGE.md) for build and evidence commands.
