-- Transition User table from password-based Vercel template to Keycloak OIDC auth.
-- Any users created with the old password system have no nextcloudId and are removed
-- along with all their dependent data (FK constraints are ON DELETE NO ACTION).

DO $$ BEGIN
  -- Vote_v2 depends on Message_v2 and Chat
  DELETE FROM "Vote_v2"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  -- Message_v2 depends on Chat
  DELETE FROM "Message_v2"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  -- Stream depends on Chat
  DELETE FROM "Stream"
    WHERE "chatId" IN (
      SELECT id FROM "Chat"
        WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL)
    );

  -- Legacy Vote / Message tables (created in early migrations, not in current schema)
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

  -- Chat depends on User
  DELETE FROM "Chat"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  -- Suggestion depends on User
  DELETE FROM "Suggestion"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  -- Document depends on User
  DELETE FROM "Document"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  -- UsageLog depends on User
  DELETE FROM "UsageLog"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  -- KnowledgeSource depends on User (DocumentChunk cascades from KnowledgeSource)
  DELETE FROM "KnowledgeSource"
    WHERE "userId" IN (SELECT id FROM "User" WHERE "nextcloudId" IS NULL);

  -- Now safe to delete the old users
  DELETE FROM "User" WHERE "nextcloudId" IS NULL;

EXCEPTION WHEN undefined_table OR undefined_column THEN
  -- Tables may not exist yet on a fresh DB; ignore
  NULL;
END $$;
--> statement-breakpoint

-- Add nextcloudId as nullable first (handles existing rows gracefully)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextcloudId" varchar(255);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();
--> statement-breakpoint

-- Enforce NOT NULL and uniqueness now that old rows are gone
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

-- Drop legacy password column (no longer used with OIDC auth)
ALTER TABLE "User" DROP COLUMN IF EXISTS "password";
