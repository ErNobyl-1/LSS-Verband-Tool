CREATE TABLE IF NOT EXISTS "alliance_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"alliance_id" integer NOT NULL,
	"alliance_name" varchar(255) NOT NULL,
	"credits_total" bigint NOT NULL,
	"rank" integer NOT NULL,
	"user_count" integer,
	"user_online_count" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"ls_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"type" varchar(100),
	"status" varchar(50) DEFAULT 'active',
	"source" varchar(50) DEFAULT 'unknown' NOT NULL,
	"category" varchar(50) DEFAULT 'emergency' NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "incidents_ls_id_unique" UNIQUE("ls_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alliance_stats_alliance_id_idx" ON "alliance_stats" USING btree ("alliance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alliance_stats_recorded_at_idx" ON "alliance_stats" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alliance_stats_alliance_time_idx" ON "alliance_stats" USING btree ("alliance_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "incidents_ls_id_idx" ON "incidents" USING btree ("ls_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_source_idx" ON "incidents" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_category_idx" ON "incidents" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_created_at_idx" ON "incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_last_seen_at_idx" ON "incidents" USING btree ("last_seen_at");