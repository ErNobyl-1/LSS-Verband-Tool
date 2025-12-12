CREATE TABLE IF NOT EXISTS "mission_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"mission_type_id" varchar(50) NOT NULL,
	"name" varchar(500) NOT NULL,
	"average_credits" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mission_types_mission_type_id_unique" UNIQUE("mission_type_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mission_types_mission_type_id_idx" ON "mission_types" USING btree ("mission_type_id");
