-- Transition User table from password-based Vercel template to Keycloak OIDC auth.

-- Step 1: Add new columns as nullable so existing rows don't immediately violate constraints
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextcloudId" varchar(255);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();
--> statement-breakpoint

-- Step 2: Delete old password-based users and all their FK-dependent data.
-- nextcloudId IS NULL identifies legacy rows (column just added, all existing rows are NULL).
-- FK constraints are ON DELETE NO ACTION so we must delete in dependency order.
DO $$ BEGIN
  DELETE FROM "Vote_v2"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  DELETE FROM "Message_v2"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  DELETE FROM "Stream"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  -- Legacy (non-v2) tables from early migrations
  DELETE FROM "Vote"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  DELETE FROM "Message"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  DELETE FROM "Chat"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  DELETE FROM "Suggestion"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  DELETE FROM "Document"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  DELETE FROM "UsageLog"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  DELETE FROM "KnowledgeSource"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  DELETE FROM "User" WHERE "nextcloudId" IS NULL;

EXCEPTION WHEN undefined_table THEN
  -- Tables may not exist on a fresh DB; that's fine
  NULL;
END $$;
--> statement-breakpoint

-- Step 3: Enforce NOT NULL and uniqueness now that legacy rows are gone
ALTER TABLE "User" ALTER COLUMN "nextcloudId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "createdAt" SET NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_nextcloudId_unique" UNIQUE ("nextcloudId");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
--> statement-breakpoint

-- Widen email from varchar(64) to varchar(255)
ALTER TABLE "User" ALTER COLUMN "email" TYPE varchar(255);
--> statement-breakpoint

-- Drop legacy password column
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
