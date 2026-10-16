ALTER TABLE "holders" ALTER COLUMN "status" SET DEFAULT 'live';--> statement-breakpoint
UPDATE "holders" SET "status" = 'live' WHERE "status" = 'pending';