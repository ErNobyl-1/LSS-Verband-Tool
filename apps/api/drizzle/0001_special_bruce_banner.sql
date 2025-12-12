CREATE TABLE IF NOT EXISTS "alliance_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"lss_member_id" integer NOT NULL,
	"alliance_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb,
	"caption" varchar(255),
	"is_online" boolean DEFAULT false,
	"role_flags" jsonb DEFAULT '{}'::jsonb,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_online_at" timestamp,
	CONSTRAINT "alliance_members_lss_member_id_unique" UNIQUE("lss_member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"lss_member_id" integer NOT NULL,
	"is_online" boolean NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mission_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"mission_type_id" varchar(50) NOT NULL,
	"name" varchar(500) NOT NULL,
	"average_credits" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mission_types_mission_type_id_unique" UNIQUE("mission_type_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alliance_members_lss_member_id_idx" ON "alliance_members" USING btree ("lss_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alliance_members_alliance_id_idx" ON "alliance_members" USING btree ("alliance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alliance_members_is_online_idx" ON "alliance_members" USING btree ("is_online");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_activity_log_lss_member_id_idx" ON "member_activity_log" USING btree ("lss_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_activity_log_recorded_at_idx" ON "member_activity_log" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_activity_log_member_time_idx" ON "member_activity_log" USING btree ("lss_member_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mission_types_mission_type_id_idx" ON "mission_types" USING btree ("mission_type_id");