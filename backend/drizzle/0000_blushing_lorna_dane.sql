CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"uploader_device_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"encrypted_key" varchar(88) NOT NULL,
	"nonce" varchar(24) NOT NULL,
	"storage_url" text,
	"storage_provider" varchar(20) DEFAULT 's3',
	"upload_status" varchar(20) DEFAULT 'PENDING',
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"storage_url" text,
	"status" varchar(20) DEFAULT 'CREATING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_user_id" uuid NOT NULL,
	"alias" varchar(100),
	"verification_status" varchar(20) DEFAULT 'UNVERIFIED' NOT NULL,
	"safety_number" varchar(60),
	"verified_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'MEMBER' NOT NULL,
	"sender_key" varchar(64),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"unread_count" integer DEFAULT 0,
	"last_read_message_id" uuid,
	"notifications_muted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(100),
	"avatar_url" text,
	"created_by_id" uuid NOT NULL,
	"disappearing_timer_ms" integer DEFAULT 0,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_one_time_prekeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"key_id" integer NOT NULL,
	"public_key" varchar(64) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_name" varchar(100),
	"platform" varchar(20) NOT NULL,
	"platform_version" varchar(50),
	"app_version" varchar(20),
	"identity_key_public" varchar(64) NOT NULL,
	"signing_key_public" varchar(64) NOT NULL,
	"signed_prekey_public" varchar(64) NOT NULL,
	"signed_prekey_signature" varchar(88) NOT NULL,
	"signed_prekey_id" integer NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"recipient_device_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"relay_message_id" uuid,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_device_id" uuid NOT NULL,
	"client_message_id" varchar(100) NOT NULL,
	"type" varchar(20) DEFAULT 'TEXT' NOT NULL,
	"content" text,
	"content_hash" varchar(64),
	"edit_of_message_id" uuid,
	"deleted_at" timestamp with time zone,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"active" boolean DEFAULT true,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relay_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"recipient_device_id" uuid NOT NULL,
	"envelope" jsonb NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 10,
	"next_retry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 5,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"display_name" varchar(100),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_device_id_devices_id_fk" FOREIGN KEY ("uploader_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "backups" ADD CONSTRAINT "backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "backups" ADD CONSTRAINT "backups_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_user_id_users_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_one_time_prekeys" ADD CONSTRAINT "device_one_time_prekeys_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_recipient_device_id_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_device_id_devices_id_fk" FOREIGN KEY ("sender_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_messages" ADD CONSTRAINT "relay_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relay_messages" ADD CONSTRAINT "relay_messages_recipient_device_id_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_message_id_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_uploader_device_idx" ON "attachments" USING btree ("uploader_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_upload_status_idx" ON "attachments" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_expires_at_idx" ON "attachments" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backups_user_id_idx" ON "backups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backups_device_id_idx" ON "backups" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backups_status_idx" ON "backups" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "backups_expires_at_idx" ON "backups" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_user_contact_idx" ON "contacts" USING btree ("user_id","contact_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_user_id_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_contact_user_id_idx" ON "contacts" USING btree ("contact_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_status_idx" ON "contacts" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conv_members_conv_device_idx" ON "conversation_members" USING btree ("conversation_id","device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_members_conv_id_idx" ON "conversation_members" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_members_user_id_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_members_device_id_idx" ON "conversation_members" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_members_left_at_idx" ON "conversation_members" USING btree ("left_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_type_idx" ON "conversations" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_created_by_idx" ON "conversations" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_deleted_at_idx" ON "conversations" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "otp_device_key_idx" ON "device_one_time_prekeys" USING btree ("device_id","key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_device_id_idx" ON "device_one_time_prekeys" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_used_at_idx" ON "device_one_time_prekeys" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_user_id_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_identity_key_idx" ON "devices" USING btree ("identity_key_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_revoked_at_idx" ON "devices" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "msg_recipients_msg_recipient_idx" ON "message_recipients" USING btree ("message_id","recipient_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_recipients_msg_id_idx" ON "message_recipients" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_recipients_recipient_device_idx" ON "message_recipients" USING btree ("recipient_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_recipients_status_idx" ON "message_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_recipients_relay_msg_id_idx" ON "message_recipients" USING btree ("relay_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conv_sent_idx" ON "messages" USING btree ("conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_sender_device_idx" ON "messages" USING btree ("sender_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_client_msg_id_idx" ON "messages" USING btree ("client_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_edit_of_idx" ON "messages" USING btree ("edit_of_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_deleted_at_idx" ON "messages" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_device_token_idx" ON "push_tokens" USING btree ("device_id","token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_tokens_device_id_idx" ON "push_tokens" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_tokens_active_idx" ON "push_tokens" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relay_msg_message_recipient_idx" ON "relay_messages" USING btree ("message_id","recipient_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_msg_recipient_device_idx" ON "relay_messages" USING btree ("recipient_device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_msg_next_retry_idx" ON "relay_messages" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_msg_expires_at_idx" ON "relay_messages" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_msg_acked_at_idx" ON "relay_messages" USING btree ("acked_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "settings_user_key_idx" ON "settings" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settings_user_id_idx" ON "settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_ops_user_device_idx" ON "sync_operations" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sync_ops_idempotency_key_idx" ON "sync_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_ops_status_idx" ON "sync_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_ops_entity_idx" ON "sync_operations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_ops_created_at_idx" ON "sync_operations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_identifier_idx" ON "users" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" USING btree ("deleted_at");