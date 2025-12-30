-- Add all new incident fields (players, timing, exact earnings)
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "players_at_mission" jsonb;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "players_driving" jsonb;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "remaining_seconds" integer;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "duration_seconds" integer;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "remaining_at" timestamp;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "exact_earnings" integer;
