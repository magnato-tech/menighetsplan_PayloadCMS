# Menighetsplan Payload CMS (Lillesand Misjonskirke)

Nettside, «Min side» og admin for Lillesand Misjonskirke, bygget med **Next.js og Payload CMS**. Dette er **Payload-versjonen**. Den er tatt vare på som den var 1. oktober 2026, mens et alternativ på Firebase utvikles i repoet `menighetsplan_ClaudeCMS`.

## Hva den gjør

- **Offentlig nettsted:** forside med hero og «Aktuelt», nestet meny, faste sider med blokker (tekst, bilde, Facebook, video, hero, kalender, kolonner), nyheter.
- **Kalender:** `/kalender` med arrangementer gruppert per måned, og en abonnerbar `.ics`-feed (`/kalender.ics`).
- **Min side:** `/min-side` med innkallinger (Kommer / Kan ikke), oppgaver, forfall-melding og gruppesider med chat. Faner for medlem, gruppeleder og admin.
- **Admin:** Payloads adminpanel på `/admin`, med dashboard, utkast/publisering på sider og nyheter, og grupperte samlinger.
- **Arrangement og bemanning** (`/admin-oversikt`, krever admin-innlogging): liste over arrangementer med status per oppgave, kjøreplan, og et **oppgavekort** per oppgave med samling, tjenestegruppe, bemanningsbehov, instruks og hvem som er forespurt, bekreftet, har avslått eller meldt forfall. Admin kan tildele (bekreftet) eller forespørre (personen svarer), og redigere arrangement og oppgaver.
- **Gruppeleder** (`/min-side/leder/arrangement/…` og `/min-side/oppgave/…`): ser og kan gripe inn på oppgaver i egen tjenestegruppe, og redigere behov og instruks der. **Medlem:** ser det som angår en selv, tar ledige oppgaver i egen gruppe, svarer ja/nei på forespørsler og melder forfall.

## Start

Krever Node 20.9 eller nyere.

```
npm start
```

Første start gjør alt selv: installerer avhengigheter, lager en lokal SQLite-database (`nettside-v2/data/nettside.db`), fyller den med mockdata, bygger appen og starter den på <http://localhost:3000>. Senere starter er raske. Den gamle MVP-en i rotmappen startes med `npm run start:mvp`.

Innloggingene til admin og et gruppeleder-eksempel skrives ut av seeding i konsollen. De er **kun demodata**.

### Egen database

Sett `DATABASE_URL` til en Postgres-adresse (`postgres://…`) for å bruke Postgres i stedet for SQLite. Postgres bruker migrasjoner (`nettside-v2/src/migrations/`); kjør `npm run payload -- migrate` i `nettside-v2/`. Sett også `PAYLOAD_SECRET` i ekte drift. Uten den brukes en demo-reserveverdi som ikke skal brukes utenfor demo.

## Publisere på Vercel med gratis Neon-database

Slik kan siden ligge på nettet uten abonnement. Du må selv opprette kontoene og legge inn hemmelighetene; ikke legg dem i git eller i chat.

1. **Neon** (<https://neon.com>): lag et gratis prosjekt og kopier tilkoblingsadressen (`postgres://…`). Hvis `payload migrate` feiler under bygg, prøv den «direkte» (ikke-pooled) adressen.
2. **Vercel** (<https://vercel.com>): *Add New → Project*, velg dette repoet. Sett **Root Directory** til `nettside-v2`. Framework blir Next.js automatisk.
3. **Blob-lagring (gjør dette FØR første deploy):** i Vercel-prosjektet, *Storage → Create → Blob → Connect to project*. Det legger inn `BLOB_READ_WRITE_TOKEN` selv. Uten den lagres bilder på byggemaskinen og forsvinner.
4. **Miljøvariabler** (Project Settings → Environment Variables):
   - `DATABASE_URL`: adressen fra Neon
   - `PAYLOAD_SECRET`: en lang tilfeldig streng (minst 32 tegn)
   - `SEED_PASSORD`: et sterkt passord (minst 12 tegn). Brukes ved første fylling av databasen med demodata. Fjern den etterpå.
5. **Deploy.** Bygget kjører `vercel-build` (`nettside-v2/scripts/vercel-build.mjs`): migrerer databasen, fyller den med demodata hvis den er tom og `SEED_PASSORD` er satt, og bygger appen.

Demobrukerne (admin og gruppeleder) får passordet du satte i `SEED_PASSORD`. Uten det stopper seeding på Vercel, slik at en kjent admin-innlogging aldri havner på en offentlig side.

**Testet:** migrering, seeding og bygg mot en ekte Postgres lokalt, og at alle sider svarer med data derfra. Sperrene (svakt `SEED_PASSORD`, manglende Blob-token) er testet.
**Ikke testet:** Selve Neon-tilkoblingen, Vercel Blob og selve Vercel-byggingen. Det kan dukke opp småfeil første gang.

**Husk:**
- Vercel Hobby er etter vilkårene for personlig, ikke-kommersiell bruk. Vurder om en menighetsside passer.
- Bare mockdata. Siden har fortsatt ikke ekte innlogging, og API-et lar alle lese de fleste samlingene (se «Kjente begrensninger»).
- Opplasting av bilder over ca. 4,5 MB i admin feiler på Vercel uten klient-opplasting (`clientUploads`), som ikke er satt opp.

## Oppbygging

| Mappe | Innhold |
|---|---|
| `nettside-v2/` | Den gjeldende appen: Next.js 16, Payload 3.90, React 19 |
| `nettside-v2/src/collections/` | Sider, Nyheter, Aktiviteter, Grupper, Oppgaver, Tildelinger, Oppmoter, GruppeMeldinger, Media, Users |
| `nettside-v2/src/lib/` | Ren logikk: `aktivitetStatus`, `gruppeLogikk`, `handlinger`, `ical` |
| `nettside-v2/src/seed/` | Mockdata |
| `scripts/start-v2.mjs` | Startskriptet bak `npm start` |
| `server.js`, `lib/`, `data/`, `innhold/`, `public/`, `test/` | Den **forlatte** MVP-en (Node uten avhengigheter). Urørt |
| `arkiv/CLAUDE-historikk.md` | Hele den gamle prosjekthistorikken (Sprint 0–13 og Payload-oppstarten) |
| `ARKITEKTUR.md`, `INTEGRASJON-MENIGHETSPLAN.md` | MVP-dokumenter om integrasjonen med Menighetsplan-appen |

## Kjente begrensninger

- **Ingen ekte innlogging.** `/min-side` er en visningsmodell: «Vis som» velger en person, og hvem som helst kan se hvem som helst sin side. Gruppeleder- og medlemsfunksjonene bruker samme «Vis som», men rettighetene (leder av gruppen, medlem av gruppen) sjekkes på serveren. Admin-oversikten krever ekte Payload-innlogging. `/logg-inn` er en plassholder. **Ikke bruk ekte persondata.**
- **Alle samlinger er lesbare for alle** via API-et (`read: () => true`).
- `npm run build` i `nettside-v2/` bygger nå med `next build` (var ødelagt tidligere). `npm start` i roten gjør hele oppstarten.
- Bilder lagres på lokal disk (`nettside-v2/media/`) lokalt, og i Vercel Blob når `BLOB_READ_WRITE_TOKEN` er satt.
- Seed-datoene er relative til dagen seeding kjøres.
- **Tester:** `npm run test` i `nettside-v2/` (115 tester, grønne 1. okt). `tests/int/flyt.test.ts` kjører de ekte handlingene mot en egen midlertidig SQLite-database og sjekker at medlem, gruppeleder og admin ser det samme. `tests/int/integritet.test.ts` sjekker at sletting i Payload ikke etterlater foreldreløse tildelinger. Ikke kjørt mot Postgres/Neon ennå.

## Backup og opphav

Denne versjonen tilsvarer branchen `payload-versjon` i `magnato-tech/menighetsplan_ClaudeCMS`. Taggen `payload-original-11bbf18` er den siste Payload-committen før SQLite-endringene (bruker Postgres).
