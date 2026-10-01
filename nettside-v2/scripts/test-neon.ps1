# Kjører databasetestene mot Neon-databasen (mockdata). Alt skjer i dette vinduet.
#
# Tilkoblingsadressen inneholder et passord, så den limes inn SKJULT (vises ikke) og lagres ikke noe sted.
# Testene oppretter egne testdata med unike navn og rydder opp etter seg. Mockdataene røres ikke.
#
# Trinn 1: migrerer Neon-databasen med Payloads egen kommando (samme som Vercel-bygget gjør).
# Trinn 2: kjører alle databasetestene (tests/int) mot Neon.
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

$kode = 1
try {
  $env:NODE_OPTIONS = '--no-deprecation'

  # Trinn 1: migrer. NODE_ENV=production hindrer at Payload endrer tabellene på egen hånd (push) i stedet for via migrasjoner.
  Write-Host ''
  Write-Host '1/2 Migrerer Neon-databasen...' -ForegroundColor Cyan
  $env:DATABASE_URL = $url
  $env:NODE_ENV = 'production'
  npx payload migrate
  $migrer = $LASTEXITCODE
  $env:DATABASE_URL = ''
  $env:NODE_ENV = ''

  if ($migrer -ne 0) {
    Write-Host 'Migreringen feilet.' -ForegroundColor Red
    $kode = $migrer
  } else {
    # Trinn 2: kjør testene. Alle testfilene bruker TEST_DATABASE_URL (se tests/setup-db.ts).
    Write-Host ''
    Write-Host '2/2 Kjører testene mot Neon...' -ForegroundColor Cyan
    $env:TEST_DATABASE_URL = $url
    $env:PAYLOAD_DB_PUSH = 'false'
    npx vitest run tests/int
    $kode = $LASTEXITCODE
  }
} finally {
  $env:TEST_DATABASE_URL = ''
  $env:PAYLOAD_DB_PUSH = ''
  $env:DATABASE_URL = ''
}

Write-Host ''
if ($kode -eq 0) {
  Write-Host 'ALLE TESTER BESTÅTT mot Neon.' -ForegroundColor Green
} else {
  Write-Host 'NOEN TESTER FEILET mot Neon. Se over.' -ForegroundColor Red
}
exit $kode
