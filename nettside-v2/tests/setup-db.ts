// Kjøres før hver testfil. Setter TEST_DATABASE_URL (Neon/Postgres) som database for ALLE testfilene,
// slik at ingen test ved et uhell bruker den lokale SQLite-databasen mens vi tror vi tester Neon.
const url = process.env.TEST_DATABASE_URL
if (url && /^postgres(ql)?:\/\//.test(url)) {
  process.env.DATABASE_URL = url
  delete process.env.SQLITE_URL
}