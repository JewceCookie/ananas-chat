# Ananas Chat

## Project Overview

Ananas Chat is a self-hosted AI chat application with deep Nextcloud integration. It is based on the [Vercel AI chatbot](https://github.com/vercel/ai-chatbot) (MIT licensed), adapted for Docker deployment.

**Core pillars:**

- **Nextcloud-native knowledge system** — RAG pipeline that indexes user files from Nextcloud, respects share permissions, and handles nearly any document type including images.
- **Multi-provider AI** — OpenAI, Anthropic, Ollama (local) out of the box; any provider addable via the Vercel AI SDK provider interface.
- **Exact cost tracking** — every AI call is metered per user with token-level granularity.
- **Nextcloud OIDC authentication** — single sign-on via Nextcloud acting as an OIDC Identity Provider.
- **German-first, translatable** — default locale is `de`; all UI strings go through `next-intl` from day one.

## Tech Stack

| Layer              | Technology                                                   |
| ------------------ | ------------------------------------------------------------ |
| Framework          | Next.js (App Router), React                                  |
| Language           | TypeScript                                                   |
| UI                 | shadcn/ui, Radix UI, Tailwind CSS                            |
| AI                 | Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`) |
| Database           | PostgreSQL (with pgcrypto) via Drizzle ORM                   |
| Vector DB          | Qdrant                                                       |
| Auth               | Auth.js v5 with custom Nextcloud OIDC provider               |
| File Access        | Nextcloud WebDAV + OCS Share API                             |
| i18n               | next-intl                                                    |
| Rate Limiting      | Redis                                           |
| Deployment         | Docker Compose (self-hosted)                                 |
| Package Manager    | pnpm                                                         |

## Architecture

```
Docker Compose Stack
├── next-app          — Next.js application (frontend + API routes)
├── postgres          — PostgreSQL 16 + pgcrypto
├── qdrant            — Qdrant vector database
├── worker            — Document processing worker (background jobs)
├── redis             — Rate limiting, resumable streams
└── ollama            — Local LLM inference (optional)

External Services
├── Nextcloud         — OIDC IdP + file storage (WebDAV)
├── OpenAI API        — Cloud LLM + embeddings
└── Anthropic API     — Cloud LLM
```

### Data flow

1. User logs in via Nextcloud OIDC. Auth.js creates a session; the OIDC access token is stored for Nextcloud API access.
2. User selects Nextcloud folders to index. The app enqueues processing jobs in PostgreSQL.
3. The document processing worker picks up jobs, fetches files via WebDAV (using the user's bearer token), extracts text, chunks, embeds, and stores vectors in Qdrant.
4. During chat, relevant document chunks are retrieved from Qdrant and injected as context into the AI prompt.
5. Every AI call is logged with token counts and cost in the `usage_log` table.

## Authentication

**Keycloak** is the central Identity Provider (IdP) for the entire platform. Both Ananas Chat and Nextcloud authenticate through Keycloak (SSO).

```
User → Keycloak (OIDC) → Ananas Chat session
                       ↘ Nextcloud (via user_oidc app)
```

**Keycloak setup:**
- Realm: configurable via `KEYCLOAK_REALM` env var
- Client for Ananas Chat: `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET`
- Redirect URI: `{APP_URL}/api/auth/callback/keycloak`
- Auth.js configured with the OIDC provider pointing to `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}`

**Nextcloud setup:**
- Install the `user_oidc` app
- Configure it to use Keycloak as the external OIDC provider
- Enable bearer token validation: `occ user_oidc:provider <id> --bearerValidation 1`
- This allows Keycloak-issued access tokens to authenticate WebDAV/OCS API requests

**How it works end-to-end:**
1. User logs in via Keycloak — single login for all services
2. Keycloak issues an OIDC access token; Auth.js creates a session and stores the token in the JWT
3. OIDC claims used: `sub` (user ID), `email`, `name`, `groups`
4. For WebDAV file access, the same Keycloak access token is used as a bearer token — Nextcloud validates it via the `user_oidc` bearer token validation
5. File permissions are governed entirely by Nextcloud's own permission model (shares, group folders, ACLs)

## Knowledge System / RAG

### File access

- User files accessed via WebDAV: `GET /remote.php/dav/files/{username}/path/to/file`
- Folder listing via `PROPFIND` on the same endpoint
- Shared folders discovered via OCS Share API: `GET /ocs/v2.php/apps/files_sharing/api/v1/shares`
- All requests authenticated with the user's OIDC bearer token

### Document processing pipeline

The worker processes documents in a background queue:

1. **Fetch** — download file from Nextcloud via WebDAV
2. **Extract** — pull text from the document:
   - PDF, DOCX, PPTX, ODT, TXT, Markdown, HTML, CSV → text extraction
   - Images (JPEG, PNG, WEBP, etc.) → send to AI for visual description, then use the description text
3. **Chunk** — split extracted text into overlapping chunks suitable for embedding
4. **Embed** — generate vector embeddings (e.g. OpenAI `text-embedding-3-small`)
5. **Store** — save vectors in Qdrant with metadata (source file, user, share ID, chunk position)

### Access control in Qdrant

- Vectors are tagged with the owning user ID and, for shared content, the share ID
- At query time, filter Qdrant results to only include vectors the requesting user has access to
- When a share is revoked in Nextcloud, a sync process removes the corresponding vectors

### User interaction

- Users can browse their Nextcloud folders in the app and select which ones to index
- Shared folders appear separately; users opt in to indexing shared content
- Re-indexing can be triggered manually or runs on a schedule to pick up changes

## AI Provider Abstraction

Use the Vercel AI SDK's provider-agnostic interface. All model interactions go through the SDK so providers are interchangeable.

**Initial providers:**
- OpenAI (`@ai-sdk/openai`)
- Anthropic (`@ai-sdk/anthropic`)
- Ollama (local, via `ollama-ai-provider` or equivalent)

**Provider registry pattern:** a configuration object maps provider IDs to their SDK setup and pricing. Adding a new provider means adding an entry to the registry and installing its SDK adapter — no changes to calling code.

## Cost Tracking

Every AI call (chat completion, embedding, image description) is tracked:

- **Captured per request:** user ID, model, provider, input tokens, output tokens, total cost, timestamp
- **Stored in:** `usage_log` table in PostgreSQL
- **Pricing source:** `model_pricing` table mapping (provider, model) → cost per 1K input/output tokens
- **User dashboard:** users can view their own usage history and cumulative cost
- **Admin dashboard:** aggregated costs across all users

The cost-tracking wrapper sits around every AI SDK call. No AI request bypasses it.

## Internationalization (i18n)

- Library: `next-intl`
- Default locale: `de` (German)
- Fallback locale: `en` (English)
- Translation files: `messages/de.json`, `messages/en.json`
- **Rule: every user-facing string must use a translation key.** Never hardcode German or English text in components.

## Database Schema Extensions

Beyond the base Vercel AI chatbot schema (User, Chat, Message_v2, Vote_v2, Document, Suggestion, Stream), the following tables are added:

| Table              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `usage_log`        | Per-request cost tracking (userId, model, provider, inputTokens, outputTokens, cost, timestamp) |
| `model_pricing`    | Cost configuration per model (provider, model, inputCostPer1k, outputCostPer1k) |
| `knowledge_source` | Nextcloud folders linked for RAG indexing (userId, path, shareId, status, lastSynced) |
| `document_chunk`   | Metadata for processed chunks — vectors live in Qdrant (sourceFile, knowledgeSourceId, chunkIndex, qdrantPointId) |
| `processing_job`   | Background job queue for the document worker (type, payload, status, attempts, scheduledAt) |

## Self-Hosting / Docker

Adaptations from the Vercel-oriented original:

- **File storage:** replace Vercel Blob with local filesystem or S3-compatible storage (MinIO)
- **Database:** replace Neon Serverless Postgres with standard PostgreSQL 16
- **Docker Compose** services: `next-app`, `postgres`, `qdrant`, `worker`, `redis`, `ollama` (optional)
- **Environment variables:** all secrets and configuration via `.env` file, documented in `.env.example`

## Coding Conventions

1. **i18n** — all user-facing text must use `next-intl` translation keys. German is the primary language. Never hardcode UI strings.
2. **AI calls** — every AI provider call must go through the cost-tracking wrapper. No direct SDK calls that bypass metering.
3. **Nextcloud client** — all Nextcloud API calls (WebDAV, OCS) use the centralized client at `lib/nextcloud/client.ts`. Never make raw HTTP calls to Nextcloud elsewhere.
4. **AI providers** — use the Vercel AI SDK provider interface for all model interactions. Never import provider-specific code outside the provider registry.
5. **Database** — use Drizzle ORM for all database access. Schema defined in `lib/db/schema.ts`.
6. **Types** — strict TypeScript. No `any` unless absolutely unavoidable and documented with a comment explaining why.
