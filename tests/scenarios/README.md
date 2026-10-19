# Synthetic scenarios

These JSON files are input fixtures for engineering tests and the application's examples. They are explicitly labeled `synthetic_test`; they do not describe additional real court cases or encode legal rules.

The [2025 IRA scenarios](us/tax/) exercise a clean conversion and a pro-rata conversion with other IRA assets. Their directory is declared by the `ira2025` module in [`oath-package.json`](../../oath-package.json). The expected results are checked by `tools/lawlib_tools/audit_tax.py` and the software repository's Rust, Python and browser tests.

Run `python tools/check.py` from the lawlib repository after priming the evidence cache. From the software repository, run:

```sh
cargo run -- tax-backdoor-roth .deps/lawlib/tests/scenarios/us/tax/synthetic-pro-rata.json
```

The actual *Shank* and *Long* reconstructions remain `.case.oath` files under [`us/`](../../us/README.md).
