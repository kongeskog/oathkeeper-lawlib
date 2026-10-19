param([string]$OathBinary = '', [switch]$AuditSources, [string]$Cache = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
if (-not $OathBinary) {
    $name = if ($env:OS -eq 'Windows_NT') { 'oath.exe' } else { 'oath' }
    $OathBinary = Join-Path $root "../oathkeeper/target/debug/$name"
}
$OathBinary = (Resolve-Path -LiteralPath $OathBinary).Path
$packages = Get-Content -Raw (Join-Path $root 'packages.json') | ConvertFrom-Json
foreach ($package in $packages) {
    $path = Join-Path $root $package
    & $OathBinary check $path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $OathBinary test $path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($AuditSources) {
        $auditArgs = @('sources', 'check', $path)
        if ($Cache) { $auditArgs += @('--cache', $Cache) }
        & $OathBinary @auditArgs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}
