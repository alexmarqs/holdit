CREATE TABLE "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holder_id" uuid NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"referrer" text,
	"ua_class" text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"url" text NOT NULL,
	"tagline" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"email" text,
	"notify_prefs" jsonb DEFAULT '{"dilution":true,"decay":true,"weekly":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holder_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"share_before" numeric(10, 8),
	"share_after" numeric(10, 8) NOT NULL,
	"provider" text DEFAULT 'polar' NOT NULL,
	"external_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"holder_id" uuid NOT NULL,
	"share" numeric(10, 8) NOT NULL,
	"live_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"visitor_hash" text PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_holder_id_holders_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."holders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_holder_id_holders_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."holders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_holder_id_holders_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."holders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_holder_ts_idx" ON "clicks" USING btree ("holder_id","ts");--> statement-breakpoint
CREATE INDEX "clicks_dedupe_idx" ON "clicks" USING btree ("holder_id","ip_hash","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "holders_handle_key" ON "holders" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "holders_status_idx" ON "holders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchases_holder_created_idx" ON "purchases" USING btree ("holder_id","created_at");--> statement-breakpoint
CREATE INDEX "purchases_created_idx" ON "purchases" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_external_order_key" ON "purchases" USING btree ("external_order_id");--> statement-breakpoint
CREATE INDEX "snapshots_holder_taken_idx" ON "snapshots" USING btree ("holder_id","taken_at");--> statement-breakpoint
CREATE INDEX "visits_last_seen_idx" ON "visits" USING btree ("last_seen_at");