# Setter nytt passord for en bruker (standard: admin Kari Nordmann) i databasen du peker på.
# Både databaseadressen og passordet skrives i skjulte felt og lagres ikke noe sted.
# Bruk: powershell -ExecutionPolicy Bypass -File scripts\sett-passord.ps1
param([string]$Epost = 'kari.nordmann@eksempel.no')

function LesSkjult($ledetekst) {
  $s = Read-Host $ledetekst -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Set-Location (Split-Path $PSScriptRoot -Parent)
$url = LesSkjult 'Lim inn Neon-adressen (postgres://...) - vises ikke'
if ($url -notmatch '^postgres(ql)?://') { Write-Host 'Det ser ikke ut som en Postgres-adresse. Avbryter.'; exit 1 }
$pw = LesSkjult "Nytt passord for $Epost (minst 12 tegn) - vises ikke"
if ($pw.Length -lt 12) { Write-Host 'Passordet må ha minst 12 tegn. Avbryter.'; exit 1 }

$env:DATABASE_URL = $url
$env:PAYLOAD_DB_PUSH = 'false'
$env:NODE_ENV = 'production'
$env:NYTT_PASSORD = $pw
$env:BRUKER_EPOST = $Epost
npx tsx scripts/sett-passord.ts
$kode = $LASTEXITCODE
Remove-Item Env:DATABASE_URL, Env:NYTT_PASSORD, Env:BRUKER_EPOST -ErrorAction SilentlyContinue
exit $kode
