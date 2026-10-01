import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_gruppemeldinger_type" AS ENUM('melding', 'system');
  ALTER TABLE "gruppemeldinger" ADD COLUMN "type" "enum_gruppemeldinger_type" DEFAULT 'melding';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gruppemeldinger" DROP COLUMN "type";
  DROP TYPE "public"."enum_gruppemeldinger_type";`)
}
