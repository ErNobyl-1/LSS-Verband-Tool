-- Add mission details fields to incidents table
ALTER TABLE "incidents" ADD COLUMN "players_at_mission" jsonb;
ALTER TABLE "incidents" ADD COLUMN "players_driving" jsonb;
ALTER TABLE "incidents" ADD COLUMN "remaining_seconds" integer;
ALTER TABLE "incidents" ADD COLUMN "duration_seconds" integer;
ALTER TABLE "incidents" ADD COLUMN "remaining_at" timestamp;
