
# from old ai chatbot (keep for now)
**For non-Vercel deployments**: You need to provide an AI Gateway API key by setting the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

This project is based on the Vercel AI Chatbot template, but heavily modified to remove bloat and add my own features (the current progress and planned features is probably best documented in agents.md). 

# Setup
I use a central Keycloak OIDC that has a realm providing auth for both this app and nextcloud. 
The setup of this is not easy, in my opinion. 
I use Cloudflare tunnel as a reverse proxy before my app, nextcloud and keycloak. 
Here's how I setup my Keycloak, but I may be missing something. 
At the time of writing, my ananas-chat is not yet working with Keycloak (or even at all) so take this all with a grain of salt.
If I missed something, either figure it out and then tell me what I need to update, or ask me for a solution. 
For problems with nextcloud, the documentation of the plugin may have more information for you.

1. Get the https://apps.nextcloud.com/apps/oidc_login OIDC login plugin for nextcloud. (I discourage you from using nextcloud as the OIDC provider, since tokens always give 100% access there as far as I know.)
2. Create a realm in keycloak for this app and nextcloud
3. Create clients ananas-chat and nextcloud. I YOLO'd my URLs: 
For nextcloud 
Root URL https://nextcloud.gossen-na.de
Home URL https://nextcloud.gossen-na.de
Valid redirect URIs https://nextcloud.gossen-na.de/apps/oidc_login/oidc; https://nextcloud.gossen-na.de/index.php/apps/oidc_login/oidc
Valid post logout redirect URIs https://nextcloud.gossen-na.de/index.php; https://nextcloud.gossen-na.de/; https://nextcloud.gossen-na.de/apps/oidc_login/oidc
Web origins https://nextcloud.gossen-na.de/index.php; https://nextcloud.gossen-na.de
Admin URL https://nextcloud.gossen-na.de

For ananas-chat
Root URL https://ananas.gossen-na.de
Home URL https://ananas.gossen-na.de
Valid redirect URIs https://ananas.gossen-na.de/api/auth/callback/keycloak
Valid post logout redirect URIs https://ananas.gossen-na.de
Web origins https://ananas.gossen-na.de
Admin URL https://ananas.gossen-na.de

"Client authentication" on, PKCE Method S256

4. For the nextcloud client, go to advanved -> Fine grain OpenID Connect configuration -> ID token signature algorithm: RS256
5. For the nextcloud client, go to the nextcloud-dedicated scope. Make a mapper nextcloud_quota by configuration "User Attribute". Make sure it's added to the ID and access token.
6. Also in the dedicated nextcloud scope, make a mapper nextcloud_groups by configuration "User Client Role". It is multivalued. Make sure it's added to the ID and access token.
7. Configure your nextcloud config correctly. My setup: 
  'allow_user_to_change_display_name' => false,
  'lost_password_link' => 'disabled',
  'oidc_login_provider_url' => 'https://auth.gossen-na.de/realms/ananas',
  'oidc_login_logout_url' => 'https://nextcloud.gossen-na.de/',
  'oidc_login_client_id' => 'nextcloud',
  'oidc_login_client_secret' => 'SECRET', ### -> GET THIS FROM KEYCLOAK
  'overwriteprotocol' => 'https',
  'oidc_login_hide_password_form' => true,
  'oidc_login_auto_redirect' => true,
  'oidc_login_end_session_redirect' => true,
  'oidc_login_button_text' => 'Login with Keycloak',
  'oidc_login_redir_fallback' => true,
  'oidc_login_disable_registration' => false,
  'oidc_login_webdav_enabled' => true,
  'oidc_login_tls_verify' => true,
  'oidc_login_code_challenge_method' => 'S256',
  'oidc_login_attributes' =>
  array (
    'id' => 'preferred_username',
    'name' => 'name',
    'mail' => 'email',
    'groups' => 'nextcloud_groups',
    'quota' => 'nextcloud_quota',
  ),
8. Pray.

I do not really have any idea how you deploy this from scratch because I am new to some of these things and it was trial and error. 
There is probably something you need to do with Postgres. For me, deploying now basically just works like this: 
git clone this repo. configure .env correctly. do "docker compose up -d --build". 

This README is absolutely trash but I will redo it with AI once this is a bit more mature. Maybe someone who deploys this from scratch can help me figure out common pitfalls.