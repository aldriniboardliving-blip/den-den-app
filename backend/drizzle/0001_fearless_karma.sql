CREATE TABLE IF NOT EXISTS "encryption_keys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"key_type" varchar(50) NOT NULL,
	"key_id" integer,
	"public_key" text,
	"private_key_encrypted" text,
	"signature" text,
	"record" text,
	"is_active" boolean DEFAULT true,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "encryption_keys" ADD CONSTRAINT "encryption_keys_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encryption_keys_device_id_idx" ON "encryption_keys" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encryption_keys_key_type_idx" ON "encryption_keys" USING btree ("key_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encryption_keys_key_id_idx" ON "encryption_keys" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "encryption_keys_is_active_idx" ON "encryption_keys" USING btree ("is_active");