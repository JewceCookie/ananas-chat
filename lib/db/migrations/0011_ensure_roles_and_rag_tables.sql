-- Idempotent re-application of migration 0009 content.
-- Migration 0009 may have been recorded as applied in __drizzle_migrations
-- without actually executing (e.g. due to a partial failure), so we
-- re-apply every statement with IF NOT EXISTS guards.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roles" json DEFAULT '[]' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "UsageLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "model" varchar(255) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "inputTokens" integer DEFAULT 0 NOT NULL,
  "outputTokens" integer DEFAULT 0 NOT NULL,
  "cost" numeric(12, 8) DEFAULT '0' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ModelPricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(64) NOT NULL,
  "model" varchar(255) NOT NULL,
  "inputCostPer1k" numeric(12, 8) DEFAULT '0' NOT NULL,
  "outputCostPer1k" numeric(12, 8) DEFAULT '0' NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "KnowledgeSource" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "path" text NOT NULL,
  "shareId" varchar(255),
  "label" varchar(255),
  "status" varchar DEFAULT 'pending' NOT NULL,
  "errorMessage" text,
  "lastSyncedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "DocumentChunk" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "knowledgeSourceId" uuid NOT NULL,
  "sourceFile" text NOT NULL,
  "chunkIndex" integer NOT NULL,
  "qdrantPointId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ProcessingJob" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar NOT NULL,
  "payload" json NOT NULL,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lastError" text,
  "scheduledAt" timestamp DEFAULT now() NOT NULL,
  "processedAt" timestamp
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_userId_User_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_knowledgeSourceId_KnowledgeSource_id_fk"
    FOREIGN KEY ("knowledgeSourceId") REFERENCES "public"."KnowledgeSource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
