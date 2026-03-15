> **Note:** This project is based on the Vercel AI Chatbot template, heavily modified to remove bloat and add custom features. Current progress and planned work is documented in `.cursor/rules/agents.md`.

# Ananas Chat

A self-hosted AI chat application with Nextcloud integration, Keycloak SSO, and a RAG pipeline for indexing and querying your own documents.

---

## Deployment

Prerequisites: Docker, a running PostgreSQL instance (in your central infra stack), a Keycloak realm, and a Nextcloud instance with the OIDC login plugin.

```bash
git clone <this repo>
cp .env.example .env   # fill in all values
docker compose up -d --build
```

That's it. The `ananas-migrate` service runs automatically on startup and applies any pending database migrations before the app starts.

---

## Data Persistence

All persistent data lives under `./data/` as bind mounts — not inside the containers. Rebuilding or restarting containers does **not** affect your data.

| Data | Location | Notes |
|---|---|---|
| PostgreSQL | External infra stack | Completely independent of this app's containers. Never touched by a rebuild. |
| Qdrant vectors | `./data/qdrant/` | Persists across restarts and rebuilds. Only lost if you manually delete this directory. |
| Redis | `./data/redis/` | Persists, but loss is harmless — only rate limiting state and resumable stream tokens. |
| File uploads | `./data/uploads/` | Persists across restarts and rebuilds. |
| DB migrations | Runs on every `docker compose up` | Idempotent — safe to run repeatedly, only applies new migrations. |

---

## Keycloak Setup

This app uses a central Keycloak realm that provides SSO for both Ananas Chat and Nextcloud. Setup is non-trivial. The steps below reflect what worked; something may be missing for your specific environment. For Nextcloud-specific issues, the [oidc_login plugin documentation](https://github.com/pulsejet/nextcloud-oidc-login) is helpful.

### 1. Install the Nextcloud OIDC plugin

Install [nextcloud-oidc-login](https://apps.nextcloud.com/apps/oidc_login) on your Nextcloud instance. Using Nextcloud as the OIDC *provider* is discouraged — tokens issued by Nextcloud give full access with no scope control.

### 2. Create a Keycloak realm

Create a realm to be shared by Ananas Chat and Nextcloud.

### 3. Create two Keycloak clients

**`nextcloud` client:**
| Field | Value |
|---|---|
| Root URL | `https://nextcloud.example.com` |
| Home URL | `https://nextcloud.example.com` |
| Valid redirect URIs | `https://nextcloud.example.com/apps/oidc_login/oidc`, `https://nextcloud.example.com/index.php/apps/oidc_login/oidc` |
| Valid post-logout redirect URIs | `https://nextcloud.example.com/`, `https://nextcloud.example.com/index.php`, `https://nextcloud.example.com/apps/oidc_login/oidc` |
| Web origins | `https://nextcloud.example.com`, `https://nextcloud.example.com/index.php` |
| Admin URL | `https://nextcloud.example.com` |

**`ananas-chat` client:**
| Field | Value |
|---|---|
| Root URL | `https://ananas.example.com` |
| Home URL | `https://ananas.example.com` |
| Valid redirect URIs | `https://ananas.example.com/api/auth/callback/keycloak` |
| Valid post-logout redirect URIs | `https://ananas.example.com` |
| Web origins | `https://ananas.example.com` |
| Admin URL | `https://ananas.example.com` |

Both clients: **Client authentication ON**, PKCE method **S256**.

### 4. Configure the `nextcloud` client

- Advanced → Fine-grained OpenID Connect configuration → **ID token signature algorithm: RS256**

### 5. Add mappers to the Nextcloud-dedicated scope

- **`nextcloud_quota`** mapper: type *User Attribute*, included in ID token and access token
- **`nextcloud_groups`** mapper: type *User Client Role*, multivalued, included in ID token and access token

### 6. Configure Nextcloud's `config.php`

```php
'allow_user_to_change_display_name' => false,
'lost_password_link'                => 'disabled',
'oidc_login_provider_url'           => 'https://auth.example.com/realms/your-realm',
'oidc_login_logout_url'             => 'https://nextcloud.example.com/',
'oidc_login_client_id'              => 'nextcloud',
'oidc_login_client_secret'          => 'SECRET', // get this from Keycloak
'overwriteprotocol'                 => 'https',
'oidc_login_hide_password_form'     => true,
'oidc_login_auto_redirect'          => true,
'oidc_login_end_session_redirect'   => true,
'oidc_login_button_text'            => 'Login with Keycloak',
'oidc_login_redir_fallback'         => true,
'oidc_login_disable_registration'   => false,
'oidc_login_webdav_enabled'         => true,
'oidc_login_tls_verify'             => true,
'oidc_login_code_challenge_method'  => 'S256',
'oidc_login_attributes' => array(
    'id'     => 'preferred_username',
    'name'   => 'name',
    'mail'   => 'email',
    'groups' => 'nextcloud_groups',
    'quota'  => 'nextcloud_quota',
),
```

### 7. Pray.
