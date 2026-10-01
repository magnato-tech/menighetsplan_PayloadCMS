# Menighetsplan Payload CMS (Lillesand Misjonskirke)

Kort prosjektinstruks for denne repoen. Hold filen under ca. 5 KB. Historikk ligger i `arkiv/CLAUDE-historikk.md` og skal ikke leses med mindre noen ber om det.

## Hva dette er

Payload-versjonen av nettsted, Min side og admin for menigheten. Den er **tatt vare på** som et ferdig alternativ. Et Firebase-spor utvikles i repoet `magnato-tech/menighetsplan_ClaudeCMS`. Dette repoet bruker **ikke** Firebase.

Product Owner (PO) er Magnar. Claude er produktsjef. PO er ikke utvikler: forklar kort og uten sjargong.

## Teknikk

- Next.js 16 + Payload 3.90 + React 19, i `nettside-v2/`.
- Database: lokal SQLite (`nettside-v2/data/nettside.db`) som standard, Postgres hvis `DATABASE_URL` er `postgres://…` (med migrasjoner i `nettside-v2/src/migrations/`). Valget gjøres i `nettside-v2/src/payload.config.ts`.
- Vercel: bygget `vercel-build` (`nettside-v2/scripts/vercel-build.mjs`) migrerer, seeder ved tom database og `SEED_PASSORD`, og bygger. Bilder i Vercel Blob når `BLOB_READ_WRITE_TOKEN` er satt. Se «Publisere på Vercel» i `README.md`.
- Start: `npm start` i roten (`scripts/start-v2.mjs` installerer, seeder, bygger og starter på port 3000).
- Samlinger: Sider (7 blokktyper, utkast/publisering), Nyheter, Aktiviteter, Grupper, Oppgaver, Tildelinger, Oppmoter, GruppeMeldinger, Media, Users. Global: Forsideinnstillinger.
- Ren logikk i `nettside-v2/src/lib/`: `aktivitetStatus`, `gruppeLogikk`, `handlinger`, `ical`.
- Den gamle MVP-en i roten (`server.js`, `lib/`, `data/`, `innhold/`, `test/`) er forlatt. Ikke bygg videre på den.

## Status

Fungerer og er verifisert å kjøre fra scratch (installere, seede, bygge, starte, alle sider svarer). Funksjonsomfanget står i `README.md`.

Kjente svakheter, ikke rettet:
- Ingen ekte innlogging. `/min-side` bruker `?som=` og er åpen for alle. `/logg-inn` er en plassholder.
- Alle samlinger har `read: () => true`.
- `handlinger.ts` tar `personId` fra skjemaet, ikke fra innloggingen. Hvem som helst kan handle på vegne av andre.
- `taOppgave` setter oppgaven til bekreftet etter én tildeling, selv om flere trengs. `statusForAktivitet` viser «Forfall» for alltid etter en tilbaketrekking.
- (Rettet 1. okt) `npm run build` bruker nå `next build`.

## Arbeidsregler

1. Bruk bare mockdata. **Ingen ekte medlemsdata** før innlogging og tilgangsregler er på plass (menighetstilhørighet er særlig kategori personopplysninger, GDPR art. 9).
2. Hent fra GitHub (`git fetch`) før du endrer og før du pusher. Sjekk at det ikke finnes nye commits.
3. Verifiser før du rapporterer: kjør `npx tsc --noEmit` og se på siden. Ikke bruk `as any` som snarvei.
4. Oppgi aldri passord eller nøkler i svar eller filer. Hemmeligheter skal i miljøvariabler (`PAYLOAD_SECRET`, `DATABASE_URL`), ikke i git.
5. Påstander om priser og vilkår skal verifiseres mot kilden eller merkes «ikke verifisert».
6. Les bare filene oppgaven trenger.

## Praktisk (Windows, PO sin maskin)

- Node og npm er installert. `git` og `gh` ligger ikke i PATH. GitHub Desktop har git: `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`.
- Push virker med `git -c credential.helper=manager push …` (Git Credential Manager har PO sin innlogging).
- Klon til en kort sti (for eksempel `C:\mp\…`). Stiene i Claudes arbeidsmappe er for lange for git.
- Claude kan ikke opprette GitHub-repoer. PO oppretter dem, Claude pusher.
- Gjør alle endringer på `master` først etter at PO har bedt om det.
