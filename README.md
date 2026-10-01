# Menighetsplan Payload CMS (Lillesand Misjonskirke)

Nettside, «Min side» og admin for Lillesand Misjonskirke, bygget med **Next.js og Payload CMS**. Dette er **Payload-versjonen**. Den er tatt vare på som den var 1. oktober 2026, mens et alternativ på Firebase utvikles i repoet `menighetsplan_ClaudeCMS`.

## Hva den gjør

- **Offentlig nettsted:** forside med hero og «Aktuelt», nestet meny, faste sider med blokker (tekst, bilde, Facebook, video, hero, kalender, kolonner), nyheter.
- **Kalender:** `/kalender` med arrangementer gruppert per måned, og en abonnerbar `.ics`-feed (`/kalender.ics`).
- **Min side:** `/min-side` med innkallinger (Kommer / Kan ikke), oppgaver, forfall-melding og gruppesider med chat. Faner for medlem, gruppeleder og admin.
- **Admin:** Payloads adminpanel på `/admin`, med dashboard, utkast/publisering på sider og nyheter, og grupperte samlinger.

## Start

Krever Node 20.9 eller nyere.

```
npm start
```

Første start gjør alt selv: installerer avhengigheter, lager en lokal SQLite-database (`nettside-v2/data/nettside.db`), fyller den med mockdata, bygger appen og starter den på <http://localhost:3000>. Senere starter er raske. Den gamle MVP-en i rotmappen startes med `npm run start:mvp`.

Innloggingene til admin og et gruppeleder-eksempel skrives ut av seeding i konsollen. De er **kun demodata**.

### Egen database

Sett `DATABASE_URL` til en Postgres-adresse (`postgres://…`) for å bruke Postgres i stedet for SQLite. Sett også `PAYLOAD_SECRET` i ekte drift. Uten den brukes en demo-reserveverdi som ikke skal brukes utenfor demo.

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

- **Ingen ekte innlogging.** `/min-side` er en visningsmodell: «Vis som» velger en person, og hvem som helst kan se hvem som helst sin side. `/logg-inn` er en plassholder. **Ikke bruk ekte persondata.**
- **Alle samlinger er lesbare for alle** via API-et (`read: () => true`).
- `npm run build` i `nettside-v2/` er ødelagt (`payload build` finnes ikke). Bruk `npx next build`. `npm start` i roten gjør dette riktig.
- Bilder lagres på lokal disk (`nettside-v2/media/`). Det forsvinner ved ny deploy uten persistent disk.
- Seed-datoene er relative til dagen seeding kjøres.
- Vitest-testene i `nettside-v2/tests/` er ikke kjørt etter siste omlegging.

## Backup og opphav

Denne versjonen tilsvarer branchen `payload-versjon` i `magnato-tech/menighetsplan_ClaudeCMS`. Taggen `payload-original-11bbf18` er den siste Payload-committen før SQLite-endringene (bruker Postgres).
