DROP INDEX "clicks_holder_ts_idx";--> statement-breakpoint
CREATE INDEX "clicks_browser_ts_idx" ON "clicks" USING btree ("ts","holder_id") WHERE "clicks"."ua_class" = 'browser';