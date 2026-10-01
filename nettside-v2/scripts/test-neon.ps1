# Kjører databasetestene mot Neon-databasen (mockdata). Alt skjer i dette vinduet.
#
# Tilkoblingsadressen inneholder et passord, så den limes inn SKJULT (vises ikke) og lagres ikke noe sted.
# Testene oppretter egne testdata med unike navn og rydder opp etter seg. Mockdataene røres ikke.
#
# Slik kjører du: åpne Neon → prosjektet → Connect → kopier adressen (postgresql://...), kjør dette skriptet, lim inn.

$ErrorActionPreference = 'Stop'
$app = Join-Path $PSScriptRoot '..'
Set-Location $app

$sikker = Read-Host 'Lim inn Neon-adressen (postgresql://...). Du ser den ikke mens du limer inn' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sikker)
try { $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

if ($url -notmatch '^postgres(ql)?://') {
  Write-Host 'Dette ligner ikke en Postgres-adresse (den skal begynne med postgresql://).' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path 'node_modules')) { npm install --no-audit --no-fund }

$env:TEST_DATABASE_URL = $url
$env:PAYLOAD_DB_PUSH = 'false'   # tabellene bygges av migrasjonene, slik som i drift
$env:NODE_OPTIONS = '--no-deprecation'
try {
  Write-Host ''
  Write-Host 'Kjører tester mot Neon (migrerer først, så testene)...' -ForegroundColor Cyan
  npx vitest run tests/int
  $kode = $LASTEXITCODE
} finally {
  Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PAYLOAD_DB_PUSH -ErrorAction SilentlyContinue
}
Write-Host ''
if ($kode -eq 0) { Write-Host 'ALLE TESTER BESTÅTT mot Neon.' -ForegroundColor Green } else { Write-Host 'NOEN TESTER FEILET mot Neon. Se over.' -ForegroundColor Red }
exit $kode
