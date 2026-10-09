ALTER TABLE "attachments" ADD COLUMN "uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "metadata" jsonb;