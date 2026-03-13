# Ananas Chat

## Project Overview

Ananas Chat is a self-hosted AI chat application with deep Nextcloud integration. It is based on the [Vercel AI chatbot](https://github.com/vercel/ai-chatbot) (MIT licensed), adapted for Docker deployment.

**Core pillars:**

- **Nextcloud-native knowledge system** — RAG pipeline that indexes user files from Nextcloud, respects share permissions, and handles nearly any document type including images.
- **Multi-provider AI** — OpenAI, Anthropic, Ollama (local) out of the box; any provider addable via the Vercel AI SDK provider interface.
- **Exact cost tracking** — every AI call is metered per user with token-level granularity.
- **Keycloak SSO** — single sign-on via Keycloak as the central OIDC Identity Provider for both Ananas Chat and Nextcloud.
- **German-first, translatable** — default locale is `de`; all UI strings go through `next-intl`. Locale is detected from `Accept-Language` header (no locale prefix in URLs).

## Tech Stack

| Layer              | Technology                                                                   |
| ------------------ | -----------------------------------------------------------------------------|
| Framework          | Next.js 16 (App Router), React 19                                            |
| Language           | TypeScript                                                                   |
| UI                 | shadcn/ui, Radix UI, Tailwind CSS                                            |
| AI                 | Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`)  |
| Database           | PostgreSQL (external/central infra) via Drizzle ORM                          |
| Vector DB          | Qdrant (in app Docker stack)                                                 |
| Auth               | Auth.js v5 (NextAuth) with Keycloak OIDC provider                            |
| File Access        | Nextcloud WebDAV + OCS Share API                                             |
| i18n               | next-intl (`localePrefix: "never"`)                                          |
| Rate Limiting      | Redis (in app Docker stack)                                                  |
| Deployment         | Docker Compose (self-hosted, behind Cloudflare Tunnel)                       |
| Package Manager    | npm                                                                          |

## Architecture

```
App Docker Stack (docker-compose.yml)
├── ananas-migrate    — one-shot migration runner (exits after running)
├── ananas-chat       — Next.js application (frontend + API routes)
├── ananas-embedder   — Document processing worker (background jobs)
├── ananas-qdrant     — Qdrant vector database
└── ananas-redis      — Rate limiting, resumable streams

Central Infra Stack (separate docker-compose, not in this repo)
├── postgres          — PostgreSQL 16 (shared across all apps)
└── keycloak          — Keycloak identity provider (shared across all apps)

External Services (bare-metal or separate server)
├── Nextcloud         — File storage (WebDAV) + OIDC client via nextcloud-oidc-login
├── Ollama            — Local LLM inference (separate Docker container on host)
├── OpenAI API        — Cloud LLM + embeddings
└── Anthropic API     — Cloud LLM
```

### Docker networking

The app stack uses two Docker networks:
- `ananas` — internal network for app services (chat, embedder, qdrant, redis)
- `infra` — external network (defined in the infra stack) that the migrate, chat, and embedder services also join to reach `postgres` and `keycloak` by container name

### Data flow

1. User logs in via Keycloak OIDC. Auth.js creates a session; the Keycloak access token is stored in the JWT for Nextcloud WebDAV access.
2. User selects Nextcloud folders to index. The app enqueues processing jobs in PostgreSQL.
3. The document processing worker picks up jobs, fetches files via WebDAV (using the user's bearer token), extracts text, chunks, embeds, and stores vectors in Qdrant.
4. During chat, relevant document chunks are retrieved from Qdrant and injected as context into the AI prompt.
5. Every AI call is logged with token counts and cost in the `usage_log` table.

## Authentication

**Keycloak** is the central Identity Provider (IdP). Both Ananas Chat and Nextcloud authenticate through Keycloak (SSO).

```
User → Keycloak (OIDC) → Ananas Chat session
                       ↘ Nextcloud (via nextcloud-oidc-login app)
```

### Keycloak setup (realm: configurable via `KEYCLOAK_REALM`)

Two clients in the same realm:

**`ananas-chat` client** (for the Next.js app):
- Type: OpenID Connect, confidential (Client authentication ON)
- PKCE Method: S256
- Valid redirect URI: `{AUTH_URL}/api/auth/callback/keycloak`
- Has the `nextcloud-audience` client scope assigned, which adds `nextcloud` to the `aud` claim of access tokens

**`nextcloud` client** (for Nextcloud):
- Type: OpenID Connect, confidential (Client authentication ON)
- PKCE Method: S256
- Valid redirect URI: `{NEXTCLOUD_URL}/apps/oidc_login/oidc`

**Audience scope** (`nextcloud-audience`):
- Client scope with an Audience mapper → Included Client Audience: `nextcloud`
- Include in token scope: ON, Add to access token: ON
- Assigned to `ananas-chat` so its tokens carry `aud: [..., "nextcloud"]`
- This allows the ananas-chat access token to authenticate Nextcloud WebDAV calls

### Nextcloud setup

Uses the [nextcloud-oidc-login](https://github.com/pulsejet/nextcloud-oidc-login) app (not the official `user_oidc`).

Key `config.php` entries:
```php
'oidc_login_provider_url'          => '{KEYCLOAK_URL}/realms/{REALM}',
'oidc_login_client_id'             => 'nextcloud',
'oidc_login_client_secret'         => '...',
'oidc_login_webdav_enabled'        => true,   // enables bearer token WebDAV auth
'oidc_login_disable_registration'  => false,  // auto-create users on first login
'oidc_login_code_challenge_method' => 'S256',
'oidc_login_attributes' => array(
    'id'   => 'preferred_username',
    'name' => 'name',
    'mail' => 'email',
),
```

`oidc_login_provider_url` must be the **public** Keycloak URL — Nextcloud fetches JWKS from it, and the `iss` claim in the token must match it exactly.

### How it works end-to-end

1. User logs in via Keycloak — single login for all services
2. Keycloak issues an access token with `aud: ["ananas-chat", "nextcloud"]`
3. Auth.js creates a session and stores the token in the JWT
4. For WebDAV file access, the same Keycloak access token is sent as a Bearer token — Nextcloud validates it against Keycloak's JWKS

### Cloudflare Tunnel — known issues and fixes

The app runs behind Cloudflare Tunnel (`cloudflared`), which terminates TLS at the edge and forwards plain HTTP to the container.

**Redirect loop fix**: Wrapping `intlMiddleware` inside `auth(...)` for ALL routes causes a redirect loop behind Cloudflare Tunnel. The fix is to handle public paths (`/login`, `/register`) with `intlMiddleware` directly, and only use `auth(req => intlMiddleware(req))` for protected paths. See `proxy.ts`.

**`KEYCLOAK_URL` must use `https://`** if Keycloak is itself behind Cloudflare Tunnel. Keycloak embeds its own URL as the `iss` claim in JWT tokens. If `KEYCLOAK_URL=http://...` but Keycloak's public URL is `https://...`, the issuer check in Auth.js will fail and logins will error out.

## Common Commands

```bash
npm run typecheck   # TypeScript type check (no emit) - make sure to run this after making changes
npm run lint        # Biome lint check (ultracite)
npm run format      # Biome auto-fix (ultracite)
npm run build       # Next.js production build
npm run dev         # Next.js dev server (Turbopack)
```

## DB Migrations

Migrations are **not** run during `docker build`. They run at container startup via the `ananas-migrate` service (uses the `builder` stage of the Dockerfile which has `tsx` available). The app (`ananas-chat`) depends on `ananas-migrate` completing successfully before it starts.

```bash
# Generate new migration files after schema changes (run locally)
npm run db:generate

# Migrations run automatically on docker compose up via ananas-migrate service
```

## Next.js 16 — proxy.ts

Next.js 16 renamed `middleware.ts` to `proxy.ts` and the export from `export default` to `export const proxy`. The file is at `proxy.ts` in the project root and composes NextAuth's `auth` wrapper with `next-intl`'s middleware.

**Important**: public paths (`/login`, `/register`) must be handled by `intlMiddleware` alone — wrapping them inside `auth(...)` causes a redirect loop behind Cloudflare Tunnel. Protected paths run `auth` first, then `intlMiddleware` inside the auth callback.

## Knowledge System / RAG

### File access

- User files accessed via WebDAV: `GET /remote.php/dav/files/{username}/path/to/file`
- Folder listing via `PROPFIND` on the same endpoint
- Shared folders discovered via OCS Share API: `GET /ocs/v2.php/apps/files_sharing/api/v1/shares`
- All requests authenticated with the user's Keycloak bearer token

### Document processing pipeline

The `ananas-embedder` worker processes documents from a PostgreSQL job queue:

1. **Fetch** — download file from Nextcloud via WebDAV
2. **Extract** — pull text from the document:
   - PDF → `pdf-parse`
   - DOCX → `mammoth`
   - TXT, Markdown, HTML, CSV → read as UTF-8
   - Images → GPT-4o-mini visual description (in German)
3. **Chunk** — split into overlapping 1000-char chunks (200-char overlap)
4. **Embed** — OpenAI `text-embedding-3-small` (1536 dimensions)
5. **Store** — upsert vectors into Qdrant collection `knowledge` with metadata (userId, knowledgeSourceId, sourceFile, chunkIndex)

### RAG in chat (not yet implemented)

`worker/qdrant.ts` has `searchSimilar()` ready, but the chat route does not yet call it. Wiring RAG into the chat route is the next major feature.

## AI Provider Abstraction

Use the Vercel AI SDK's provider-agnostic interface. All model interactions go through the SDK.

**Providers:**
- OpenAI (`@ai-sdk/openai`)
- Anthropic (`@ai-sdk/anthropic`)
- Ollama (local, via `ollama-ai-provider`) — Ollama runs as a separate container on the host, not in the app stack

**Provider registry:** `lib/ai/registry.ts` maps provider IDs to SDK setup and pricing. Adding a provider = adding a registry entry + installing its SDK adapter.

## Cost Tracking

Every AI call (chat completion, embedding, image description) is tracked:

- **Captured per request:** user ID, model, provider, input tokens, output tokens, total cost, timestamp
- **Stored in:** `usage_log` table in PostgreSQL
- **Pricing source:** `model_pricing` table mapping (provider, model) → cost per 1K input/output tokens

The cost-tracking wrapper sits around every AI SDK call. No AI request bypasses it.

## Internationalization (i18n)

- Library: `next-intl`
- Default locale: `de` (German)
- Fallback locale: `en` (English)
- Translation files: `messages/de.json`, `messages/en.json`
- `localePrefix: "never"` — locale is detected from `Accept-Language` header, never appears in the URL
- **Rule: every user-facing string must use a translation key.** Never hardcode German or English text in components.

## Database Schema

Beyond the base Vercel AI chatbot schema (User, Chat, Message_v2, Vote_v2, Document, Suggestion, Stream), the following tables are added:

| Table              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `usage_log`        | Per-request cost tracking (userId, model, provider, inputTokens, outputTokens, cost, timestamp) |
| `model_pricing`    | Cost configuration per model (provider, model, inputCostPer1k, outputCostPer1k) |
| `knowledge_source` | Nextcloud folders linked for RAG indexing (userId, path, shareId, status, lastSynced) |
| `document_chunk`   | Metadata for processed chunks — vectors live in Qdrant (sourceFile, knowledgeSourceId, chunkIndex, qdrantPointId) |
| `processing_job`   | Background job queue for the document worker (type, payload, status, attempts, scheduledAt) |

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption secret |
| `AUTH_URL` | Public URL of the app (e.g. `https://ananas.example.com`) |
| `KEYCLOAK_URL` | Public Keycloak URL (e.g. `https://auth.example.com`) |
| `KEYCLOAK_REALM` | Keycloak realm name |
| `KEYCLOAK_CLIENT_ID` | `ananas-chat` |
| `KEYCLOAK_CLIENT_SECRET` | Client secret from Keycloak |
| `NEXTCLOUD_URL` | Nextcloud instance URL |
| `POSTGRES_URL` | Connection string to central Postgres |
| `QDRANT_URL` | Qdrant URL (internal: `http://ananas-qdrant:6333`) |
| `REDIS_URL` | Redis URL (internal: `redis://ananas-redis:6379`) |
| `OLLAMA_BASE_URL` | Ollama URL (host container, e.g. `http://192.168.1.100:11434`) |

## Coding Conventions

1. **i18n** — all user-facing text must use `next-intl` translation keys. German is the primary language. Never hardcode UI strings.
2. **AI calls** — every AI provider call must go through the cost-tracking wrapper. No direct SDK calls that bypass metering.
3. **Nextcloud client** — all Nextcloud API calls (WebDAV, OCS) use the centralized client at `lib/nextcloud/client.ts`. Never make raw HTTP calls to Nextcloud elsewhere.
4. **AI providers** — use the Vercel AI SDK provider interface for all model interactions. Never import provider-specific code outside the provider registry.
5. **Database** — use Drizzle ORM for all database access. Schema defined in `lib/db/schema.ts`.
6. **Types** — strict TypeScript. No `any` unless absolutely unavoidable and documented with a comment explaining why.
