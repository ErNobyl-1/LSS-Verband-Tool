CREATE TABLE IF NOT EXISTS "access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "access_tokens_token_idx" ON "access_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_tokens_is_active_idx" ON "access_tokens" USING btree ("is_active");