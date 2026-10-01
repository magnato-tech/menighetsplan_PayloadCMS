import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_global_rolle" AS ENUM('member', 'admin');
  CREATE TYPE "public"."enum_sider_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__sider_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_nyheter_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__nyheter_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_aktiviteter_type" AS ENUM('arrangement', 'gruppesamling');
  CREATE TYPE "public"."enum_grupper_kategori" AS ENUM('tjenestegruppe', 'husgruppe', 'strategigruppe', 'ledergruppe');
  CREATE TYPE "public"."enum_grupper_moteplan_ukedag" AS ENUM('Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag');
  CREATE TYPE "public"."enum_grupper_moteplan_frekvens" AS ENUM('hver uke', 'annenhver uke', 'hver måned');
  CREATE TYPE "public"."enum_oppgaver_status" AS ENUM('open', 'assigned', 'confirmed', 'vacant', 'cancelled');
  CREATE TYPE "public"."enum_tildelinger_svar" AS ENUM('pending', 'confirmed', 'declined', 'withdrawn');
  CREATE TYPE "public"."enum_oppmoter_status" AS ENUM('attending', 'declined');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"navn" varchar NOT NULL,
  	"global_rolle" "enum_users_global_rolle" DEFAULT 'member' NOT NULL,
  	"telefon" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "sider_blocks_tekst" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"innhold" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_bilde" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bilde_id" integer,
  	"bildetekst" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_facebook" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"bildetekst" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bilde_id" integer,
  	"overskrift" varchar,
  	"knapp_tekst" varchar,
  	"knapp_lenke" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_kalender" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tittel" varchar DEFAULT 'Kommende arrangementer',
  	"antall" numeric DEFAULT 5,
  	"kun_gudstjenester" boolean DEFAULT false,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider_blocks_kolonner_kolonner" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"overskrift" varchar,
  	"bilde_id" integer,
  	"innhold" jsonb
  );
  
  CREATE TABLE "sider_blocks_kolonner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "sider" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tittel" varchar,
  	"slug" varchar,
  	"vis_i_meny" boolean DEFAULT true,
  	"rekkefolge" numeric DEFAULT 0,
  	"foreldreside_id" integer,
  	"sorteringsnokkel" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_sider_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_sider_v_blocks_tekst" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"innhold" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_bilde" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"bilde_id" integer,
  	"bildetekst" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_facebook" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_video" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"bildetekst" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"bilde_id" integer,
  	"overskrift" varchar,
  	"knapp_tekst" varchar,
  	"knapp_lenke" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_kalender" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tittel" varchar DEFAULT 'Kommende arrangementer',
  	"antall" numeric DEFAULT 5,
  	"kun_gudstjenester" boolean DEFAULT false,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_kolonner_kolonner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"overskrift" varchar,
  	"bilde_id" integer,
  	"innhold" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_sider_v_blocks_kolonner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_sider_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tittel" varchar,
  	"version_slug" varchar,
  	"version_vis_i_meny" boolean DEFAULT true,
  	"version_rekkefolge" numeric DEFAULT 0,
  	"version_foreldreside_id" integer,
  	"version_sorteringsnokkel" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__sider_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "nyheter" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tittel" varchar,
  	"slug" varchar,
  	"bilde_id" integer,
  	"ingress" varchar,
  	"innhold" jsonb,
  	"publisert_dato" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_nyheter_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_nyheter_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tittel" varchar,
  	"version_slug" varchar,
  	"version_bilde_id" integer,
  	"version_ingress" varchar,
  	"version_innhold" jsonb,
  	"version_publisert_dato" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__nyheter_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "aktiviteter_program" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"klokkeslett" varchar NOT NULL,
  	"tittel" varchar NOT NULL,
  	"beskrivelse" varchar,
  	"oppgave_id" integer
  );
  
  CREATE TABLE "aktiviteter" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gruppe_id" integer NOT NULL,
  	"tittel" varchar NOT NULL,
  	"bilde_id" integer NOT NULL,
  	"start" timestamp(3) with time zone NOT NULL,
  	"slutt" timestamp(3) with time zone,
  	"sted" varchar,
  	"type" "enum_aktiviteter_type" DEFAULT 'arrangement',
  	"tema" varchar,
  	"bibeltekst" varchar,
  	"vert_id" integer,
  	"invitasjon_sendt" boolean DEFAULT false,
  	"invitasjon_sendt_dato" timestamp(3) with time zone,
  	"offentlig" boolean DEFAULT false,
  	"er_gudstjeneste" boolean DEFAULT false,
  	"avlyst" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "grupper" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"navn" varchar NOT NULL,
  	"kategori" "enum_grupper_kategori",
  	"moteplan_ukedag" "enum_grupper_moteplan_ukedag",
  	"moteplan_klokkeslett" varchar,
  	"moteplan_frekvens" "enum_grupper_moteplan_frekvens",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "grupper_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "oppgaver" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"aktivitet_id" integer NOT NULL,
  	"gruppe_id" integer NOT NULL,
  	"tittel" varchar NOT NULL,
  	"beskrivelse" varchar,
  	"instruksjon" varchar,
  	"status" "enum_oppgaver_status" DEFAULT 'open',
  	"antall_trengs" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tildelinger" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"oppgave_id" integer NOT NULL,
  	"person_id" integer NOT NULL,
  	"svar" "enum_tildelinger_svar" DEFAULT 'pending',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gruppemeldinger" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"gruppe_id" integer NOT NULL,
  	"avsender_id" integer NOT NULL,
  	"innhold" varchar NOT NULL,
  	"bilde_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oppmoter" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"aktivitet_id" integer NOT NULL,
  	"person_id" integer NOT NULL,
  	"status" "enum_oppmoter_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"sider_id" integer,
  	"nyheter_id" integer,
  	"aktiviteter_id" integer,
  	"grupper_id" integer,
  	"oppgaver_id" integer,
  	"tildelinger_id" integer,
  	"gruppemeldinger_id" integer,
  	"oppmoter_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forsideinnstillinger" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_bilde_id" integer,
  	"hero_overskrift" varchar DEFAULT 'Velkommen til Lillesand Misjonskirke',
  	"hero_knapp_tekst" varchar DEFAULT 'Les mer',
  	"hero_knapp_lenke" varchar DEFAULT '/om-oss',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_tekst" ADD CONSTRAINT "sider_blocks_tekst_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_bilde" ADD CONSTRAINT "sider_blocks_bilde_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sider_blocks_bilde" ADD CONSTRAINT "sider_blocks_bilde_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_facebook" ADD CONSTRAINT "sider_blocks_facebook_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_video" ADD CONSTRAINT "sider_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_hero" ADD CONSTRAINT "sider_blocks_hero_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sider_blocks_hero" ADD CONSTRAINT "sider_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_kalender" ADD CONSTRAINT "sider_blocks_kalender_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_kolonner_kolonner" ADD CONSTRAINT "sider_blocks_kolonner_kolonner_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sider_blocks_kolonner_kolonner" ADD CONSTRAINT "sider_blocks_kolonner_kolonner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider_blocks_kolonner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider_blocks_kolonner" ADD CONSTRAINT "sider_blocks_kolonner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sider" ADD CONSTRAINT "sider_foreldreside_id_sider_id_fk" FOREIGN KEY ("foreldreside_id") REFERENCES "public"."sider"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_tekst" ADD CONSTRAINT "_sider_v_blocks_tekst_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_bilde" ADD CONSTRAINT "_sider_v_blocks_bilde_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_bilde" ADD CONSTRAINT "_sider_v_blocks_bilde_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_facebook" ADD CONSTRAINT "_sider_v_blocks_facebook_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_video" ADD CONSTRAINT "_sider_v_blocks_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_hero" ADD CONSTRAINT "_sider_v_blocks_hero_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_hero" ADD CONSTRAINT "_sider_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_kalender" ADD CONSTRAINT "_sider_v_blocks_kalender_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_kolonner_kolonner" ADD CONSTRAINT "_sider_v_blocks_kolonner_kolonner_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_kolonner_kolonner" ADD CONSTRAINT "_sider_v_blocks_kolonner_kolonner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v_blocks_kolonner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v_blocks_kolonner" ADD CONSTRAINT "_sider_v_blocks_kolonner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sider_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sider_v" ADD CONSTRAINT "_sider_v_parent_id_sider_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sider"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sider_v" ADD CONSTRAINT "_sider_v_version_foreldreside_id_sider_id_fk" FOREIGN KEY ("version_foreldreside_id") REFERENCES "public"."sider"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "nyheter" ADD CONSTRAINT "nyheter_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nyheter_v" ADD CONSTRAINT "_nyheter_v_parent_id_nyheter_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nyheter"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nyheter_v" ADD CONSTRAINT "_nyheter_v_version_bilde_id_media_id_fk" FOREIGN KEY ("version_bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "aktiviteter_program" ADD CONSTRAINT "aktiviteter_program_oppgave_id_oppgaver_id_fk" FOREIGN KEY ("oppgave_id") REFERENCES "public"."oppgaver"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "aktiviteter_program" ADD CONSTRAINT "aktiviteter_program_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."aktiviteter"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "aktiviteter" ADD CONSTRAINT "aktiviteter_gruppe_id_grupper_id_fk" FOREIGN KEY ("gruppe_id") REFERENCES "public"."grupper"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "aktiviteter" ADD CONSTRAINT "aktiviteter_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "aktiviteter" ADD CONSTRAINT "aktiviteter_vert_id_users_id_fk" FOREIGN KEY ("vert_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "grupper_rels" ADD CONSTRAINT "grupper_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."grupper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "grupper_rels" ADD CONSTRAINT "grupper_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oppgaver" ADD CONSTRAINT "oppgaver_aktivitet_id_aktiviteter_id_fk" FOREIGN KEY ("aktivitet_id") REFERENCES "public"."aktiviteter"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oppgaver" ADD CONSTRAINT "oppgaver_gruppe_id_grupper_id_fk" FOREIGN KEY ("gruppe_id") REFERENCES "public"."grupper"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tildelinger" ADD CONSTRAINT "tildelinger_oppgave_id_oppgaver_id_fk" FOREIGN KEY ("oppgave_id") REFERENCES "public"."oppgaver"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tildelinger" ADD CONSTRAINT "tildelinger_person_id_users_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gruppemeldinger" ADD CONSTRAINT "gruppemeldinger_gruppe_id_grupper_id_fk" FOREIGN KEY ("gruppe_id") REFERENCES "public"."grupper"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gruppemeldinger" ADD CONSTRAINT "gruppemeldinger_avsender_id_users_id_fk" FOREIGN KEY ("avsender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gruppemeldinger" ADD CONSTRAINT "gruppemeldinger_bilde_id_media_id_fk" FOREIGN KEY ("bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oppmoter" ADD CONSTRAINT "oppmoter_aktivitet_id_aktiviteter_id_fk" FOREIGN KEY ("aktivitet_id") REFERENCES "public"."aktiviteter"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oppmoter" ADD CONSTRAINT "oppmoter_person_id_users_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sider_fk" FOREIGN KEY ("sider_id") REFERENCES "public"."sider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_nyheter_fk" FOREIGN KEY ("nyheter_id") REFERENCES "public"."nyheter"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_aktiviteter_fk" FOREIGN KEY ("aktiviteter_id") REFERENCES "public"."aktiviteter"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_grupper_fk" FOREIGN KEY ("grupper_id") REFERENCES "public"."grupper"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oppgaver_fk" FOREIGN KEY ("oppgaver_id") REFERENCES "public"."oppgaver"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tildelinger_fk" FOREIGN KEY ("tildelinger_id") REFERENCES "public"."tildelinger"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gruppemeldinger_fk" FOREIGN KEY ("gruppemeldinger_id") REFERENCES "public"."gruppemeldinger"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oppmoter_fk" FOREIGN KEY ("oppmoter_id") REFERENCES "public"."oppmoter"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forsideinnstillinger" ADD CONSTRAINT "forsideinnstillinger_hero_bilde_id_media_id_fk" FOREIGN KEY ("hero_bilde_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "sider_blocks_tekst_order_idx" ON "sider_blocks_tekst" USING btree ("_order");
  CREATE INDEX "sider_blocks_tekst_parent_id_idx" ON "sider_blocks_tekst" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_tekst_path_idx" ON "sider_blocks_tekst" USING btree ("_path");
  CREATE INDEX "sider_blocks_bilde_order_idx" ON "sider_blocks_bilde" USING btree ("_order");
  CREATE INDEX "sider_blocks_bilde_parent_id_idx" ON "sider_blocks_bilde" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_bilde_path_idx" ON "sider_blocks_bilde" USING btree ("_path");
  CREATE INDEX "sider_blocks_bilde_bilde_idx" ON "sider_blocks_bilde" USING btree ("bilde_id");
  CREATE INDEX "sider_blocks_facebook_order_idx" ON "sider_blocks_facebook" USING btree ("_order");
  CREATE INDEX "sider_blocks_facebook_parent_id_idx" ON "sider_blocks_facebook" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_facebook_path_idx" ON "sider_blocks_facebook" USING btree ("_path");
  CREATE INDEX "sider_blocks_video_order_idx" ON "sider_blocks_video" USING btree ("_order");
  CREATE INDEX "sider_blocks_video_parent_id_idx" ON "sider_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_video_path_idx" ON "sider_blocks_video" USING btree ("_path");
  CREATE INDEX "sider_blocks_hero_order_idx" ON "sider_blocks_hero" USING btree ("_order");
  CREATE INDEX "sider_blocks_hero_parent_id_idx" ON "sider_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_hero_path_idx" ON "sider_blocks_hero" USING btree ("_path");
  CREATE INDEX "sider_blocks_hero_bilde_idx" ON "sider_blocks_hero" USING btree ("bilde_id");
  CREATE INDEX "sider_blocks_kalender_order_idx" ON "sider_blocks_kalender" USING btree ("_order");
  CREATE INDEX "sider_blocks_kalender_parent_id_idx" ON "sider_blocks_kalender" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_kalender_path_idx" ON "sider_blocks_kalender" USING btree ("_path");
  CREATE INDEX "sider_blocks_kolonner_kolonner_order_idx" ON "sider_blocks_kolonner_kolonner" USING btree ("_order");
  CREATE INDEX "sider_blocks_kolonner_kolonner_parent_id_idx" ON "sider_blocks_kolonner_kolonner" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_kolonner_kolonner_bilde_idx" ON "sider_blocks_kolonner_kolonner" USING btree ("bilde_id");
  CREATE INDEX "sider_blocks_kolonner_order_idx" ON "sider_blocks_kolonner" USING btree ("_order");
  CREATE INDEX "sider_blocks_kolonner_parent_id_idx" ON "sider_blocks_kolonner" USING btree ("_parent_id");
  CREATE INDEX "sider_blocks_kolonner_path_idx" ON "sider_blocks_kolonner" USING btree ("_path");
  CREATE UNIQUE INDEX "sider_slug_idx" ON "sider" USING btree ("slug");
  CREATE INDEX "sider_foreldreside_idx" ON "sider" USING btree ("foreldreside_id");
  CREATE INDEX "sider_updated_at_idx" ON "sider" USING btree ("updated_at");
  CREATE INDEX "sider_created_at_idx" ON "sider" USING btree ("created_at");
  CREATE INDEX "sider__status_idx" ON "sider" USING btree ("_status");
  CREATE INDEX "_sider_v_blocks_tekst_order_idx" ON "_sider_v_blocks_tekst" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_tekst_parent_id_idx" ON "_sider_v_blocks_tekst" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_tekst_path_idx" ON "_sider_v_blocks_tekst" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_bilde_order_idx" ON "_sider_v_blocks_bilde" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_bilde_parent_id_idx" ON "_sider_v_blocks_bilde" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_bilde_path_idx" ON "_sider_v_blocks_bilde" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_bilde_bilde_idx" ON "_sider_v_blocks_bilde" USING btree ("bilde_id");
  CREATE INDEX "_sider_v_blocks_facebook_order_idx" ON "_sider_v_blocks_facebook" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_facebook_parent_id_idx" ON "_sider_v_blocks_facebook" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_facebook_path_idx" ON "_sider_v_blocks_facebook" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_video_order_idx" ON "_sider_v_blocks_video" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_video_parent_id_idx" ON "_sider_v_blocks_video" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_video_path_idx" ON "_sider_v_blocks_video" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_hero_order_idx" ON "_sider_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_hero_parent_id_idx" ON "_sider_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_hero_path_idx" ON "_sider_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_hero_bilde_idx" ON "_sider_v_blocks_hero" USING btree ("bilde_id");
  CREATE INDEX "_sider_v_blocks_kalender_order_idx" ON "_sider_v_blocks_kalender" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_kalender_parent_id_idx" ON "_sider_v_blocks_kalender" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_kalender_path_idx" ON "_sider_v_blocks_kalender" USING btree ("_path");
  CREATE INDEX "_sider_v_blocks_kolonner_kolonner_order_idx" ON "_sider_v_blocks_kolonner_kolonner" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_kolonner_kolonner_parent_id_idx" ON "_sider_v_blocks_kolonner_kolonner" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_kolonner_kolonner_bilde_idx" ON "_sider_v_blocks_kolonner_kolonner" USING btree ("bilde_id");
  CREATE INDEX "_sider_v_blocks_kolonner_order_idx" ON "_sider_v_blocks_kolonner" USING btree ("_order");
  CREATE INDEX "_sider_v_blocks_kolonner_parent_id_idx" ON "_sider_v_blocks_kolonner" USING btree ("_parent_id");
  CREATE INDEX "_sider_v_blocks_kolonner_path_idx" ON "_sider_v_blocks_kolonner" USING btree ("_path");
  CREATE INDEX "_sider_v_parent_idx" ON "_sider_v" USING btree ("parent_id");
  CREATE INDEX "_sider_v_version_version_slug_idx" ON "_sider_v" USING btree ("version_slug");
  CREATE INDEX "_sider_v_version_version_foreldreside_idx" ON "_sider_v" USING btree ("version_foreldreside_id");
  CREATE INDEX "_sider_v_version_version_updated_at_idx" ON "_sider_v" USING btree ("version_updated_at");
  CREATE INDEX "_sider_v_version_version_created_at_idx" ON "_sider_v" USING btree ("version_created_at");
  CREATE INDEX "_sider_v_version_version__status_idx" ON "_sider_v" USING btree ("version__status");
  CREATE INDEX "_sider_v_created_at_idx" ON "_sider_v" USING btree ("created_at");
  CREATE INDEX "_sider_v_updated_at_idx" ON "_sider_v" USING btree ("updated_at");
  CREATE INDEX "_sider_v_latest_idx" ON "_sider_v" USING btree ("latest");
  CREATE UNIQUE INDEX "nyheter_slug_idx" ON "nyheter" USING btree ("slug");
  CREATE INDEX "nyheter_bilde_idx" ON "nyheter" USING btree ("bilde_id");
  CREATE INDEX "nyheter_updated_at_idx" ON "nyheter" USING btree ("updated_at");
  CREATE INDEX "nyheter_created_at_idx" ON "nyheter" USING btree ("created_at");
  CREATE INDEX "nyheter__status_idx" ON "nyheter" USING btree ("_status");
  CREATE INDEX "_nyheter_v_parent_idx" ON "_nyheter_v" USING btree ("parent_id");
  CREATE INDEX "_nyheter_v_version_version_slug_idx" ON "_nyheter_v" USING btree ("version_slug");
  CREATE INDEX "_nyheter_v_version_version_bilde_idx" ON "_nyheter_v" USING btree ("version_bilde_id");
  CREATE INDEX "_nyheter_v_version_version_updated_at_idx" ON "_nyheter_v" USING btree ("version_updated_at");
  CREATE INDEX "_nyheter_v_version_version_created_at_idx" ON "_nyheter_v" USING btree ("version_created_at");
  CREATE INDEX "_nyheter_v_version_version__status_idx" ON "_nyheter_v" USING btree ("version__status");
  CREATE INDEX "_nyheter_v_created_at_idx" ON "_nyheter_v" USING btree ("created_at");
  CREATE INDEX "_nyheter_v_updated_at_idx" ON "_nyheter_v" USING btree ("updated_at");
  CREATE INDEX "_nyheter_v_latest_idx" ON "_nyheter_v" USING btree ("latest");
  CREATE INDEX "aktiviteter_program_order_idx" ON "aktiviteter_program" USING btree ("_order");
  CREATE INDEX "aktiviteter_program_parent_id_idx" ON "aktiviteter_program" USING btree ("_parent_id");
  CREATE INDEX "aktiviteter_program_oppgave_idx" ON "aktiviteter_program" USING btree ("oppgave_id");
  CREATE INDEX "aktiviteter_gruppe_idx" ON "aktiviteter" USING btree ("gruppe_id");
  CREATE INDEX "aktiviteter_bilde_idx" ON "aktiviteter" USING btree ("bilde_id");
  CREATE INDEX "aktiviteter_vert_idx" ON "aktiviteter" USING btree ("vert_id");
  CREATE INDEX "aktiviteter_updated_at_idx" ON "aktiviteter" USING btree ("updated_at");
  CREATE INDEX "aktiviteter_created_at_idx" ON "aktiviteter" USING btree ("created_at");
  CREATE INDEX "grupper_updated_at_idx" ON "grupper" USING btree ("updated_at");
  CREATE INDEX "grupper_created_at_idx" ON "grupper" USING btree ("created_at");
  CREATE INDEX "grupper_rels_order_idx" ON "grupper_rels" USING btree ("order");
  CREATE INDEX "grupper_rels_parent_idx" ON "grupper_rels" USING btree ("parent_id");
  CREATE INDEX "grupper_rels_path_idx" ON "grupper_rels" USING btree ("path");
  CREATE INDEX "grupper_rels_users_id_idx" ON "grupper_rels" USING btree ("users_id");
  CREATE INDEX "oppgaver_aktivitet_idx" ON "oppgaver" USING btree ("aktivitet_id");
  CREATE INDEX "oppgaver_gruppe_idx" ON "oppgaver" USING btree ("gruppe_id");
  CREATE INDEX "oppgaver_updated_at_idx" ON "oppgaver" USING btree ("updated_at");
  CREATE INDEX "oppgaver_created_at_idx" ON "oppgaver" USING btree ("created_at");
  CREATE INDEX "tildelinger_oppgave_idx" ON "tildelinger" USING btree ("oppgave_id");
  CREATE INDEX "tildelinger_person_idx" ON "tildelinger" USING btree ("person_id");
  CREATE INDEX "tildelinger_updated_at_idx" ON "tildelinger" USING btree ("updated_at");
  CREATE INDEX "tildelinger_created_at_idx" ON "tildelinger" USING btree ("created_at");
  CREATE INDEX "gruppemeldinger_gruppe_idx" ON "gruppemeldinger" USING btree ("gruppe_id");
  CREATE INDEX "gruppemeldinger_avsender_idx" ON "gruppemeldinger" USING btree ("avsender_id");
  CREATE INDEX "gruppemeldinger_bilde_idx" ON "gruppemeldinger" USING btree ("bilde_id");
  CREATE INDEX "gruppemeldinger_updated_at_idx" ON "gruppemeldinger" USING btree ("updated_at");
  CREATE INDEX "gruppemeldinger_created_at_idx" ON "gruppemeldinger" USING btree ("created_at");
  CREATE INDEX "oppmoter_aktivitet_idx" ON "oppmoter" USING btree ("aktivitet_id");
  CREATE INDEX "oppmoter_person_idx" ON "oppmoter" USING btree ("person_id");
  CREATE INDEX "oppmoter_updated_at_idx" ON "oppmoter" USING btree ("updated_at");
  CREATE INDEX "oppmoter_created_at_idx" ON "oppmoter" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_sider_id_idx" ON "payload_locked_documents_rels" USING btree ("sider_id");
  CREATE INDEX "payload_locked_documents_rels_nyheter_id_idx" ON "payload_locked_documents_rels" USING btree ("nyheter_id");
  CREATE INDEX "payload_locked_documents_rels_aktiviteter_id_idx" ON "payload_locked_documents_rels" USING btree ("aktiviteter_id");
  CREATE INDEX "payload_locked_documents_rels_grupper_id_idx" ON "payload_locked_documents_rels" USING btree ("grupper_id");
  CREATE INDEX "payload_locked_documents_rels_oppgaver_id_idx" ON "payload_locked_documents_rels" USING btree ("oppgaver_id");
  CREATE INDEX "payload_locked_documents_rels_tildelinger_id_idx" ON "payload_locked_documents_rels" USING btree ("tildelinger_id");
  CREATE INDEX "payload_locked_documents_rels_gruppemeldinger_id_idx" ON "payload_locked_documents_rels" USING btree ("gruppemeldinger_id");
  CREATE INDEX "payload_locked_documents_rels_oppmoter_id_idx" ON "payload_locked_documents_rels" USING btree ("oppmoter_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "forsideinnstillinger_hero_bilde_idx" ON "forsideinnstillinger" USING btree ("hero_bilde_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "sider_blocks_tekst" CASCADE;
  DROP TABLE "sider_blocks_bilde" CASCADE;
  DROP TABLE "sider_blocks_facebook" CASCADE;
  DROP TABLE "sider_blocks_video" CASCADE;
  DROP TABLE "sider_blocks_hero" CASCADE;
  DROP TABLE "sider_blocks_kalender" CASCADE;
  DROP TABLE "sider_blocks_kolonner_kolonner" CASCADE;
  DROP TABLE "sider_blocks_kolonner" CASCADE;
  DROP TABLE "sider" CASCADE;
  DROP TABLE "_sider_v_blocks_tekst" CASCADE;
  DROP TABLE "_sider_v_blocks_bilde" CASCADE;
  DROP TABLE "_sider_v_blocks_facebook" CASCADE;
  DROP TABLE "_sider_v_blocks_video" CASCADE;
  DROP TABLE "_sider_v_blocks_hero" CASCADE;
  DROP TABLE "_sider_v_blocks_kalender" CASCADE;
  DROP TABLE "_sider_v_blocks_kolonner_kolonner" CASCADE;
  DROP TABLE "_sider_v_blocks_kolonner" CASCADE;
  DROP TABLE "_sider_v" CASCADE;
  DROP TABLE "nyheter" CASCADE;
  DROP TABLE "_nyheter_v" CASCADE;
  DROP TABLE "aktiviteter_program" CASCADE;
  DROP TABLE "aktiviteter" CASCADE;
  DROP TABLE "grupper" CASCADE;
  DROP TABLE "grupper_rels" CASCADE;
  DROP TABLE "oppgaver" CASCADE;
  DROP TABLE "tildelinger" CASCADE;
  DROP TABLE "gruppemeldinger" CASCADE;
  DROP TABLE "oppmoter" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "forsideinnstillinger" CASCADE;
  DROP TYPE "public"."enum_users_global_rolle";
  DROP TYPE "public"."enum_sider_status";
  DROP TYPE "public"."enum__sider_v_version_status";
  DROP TYPE "public"."enum_nyheter_status";
  DROP TYPE "public"."enum__nyheter_v_version_status";
  DROP TYPE "public"."enum_aktiviteter_type";
  DROP TYPE "public"."enum_grupper_kategori";
  DROP TYPE "public"."enum_grupper_moteplan_ukedag";
  DROP TYPE "public"."enum_grupper_moteplan_frekvens";
  DROP TYPE "public"."enum_oppgaver_status";
  DROP TYPE "public"."enum_tildelinger_svar";
  DROP TYPE "public"."enum_oppmoter_status";`)
}
