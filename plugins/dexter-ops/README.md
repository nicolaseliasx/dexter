# Dexter Ops (plugin)

Control panel for the [Dexter Ops](https://github.com/nicolaseliasx/dexter-ops) Telegram bot, inside Termix.

The bot stays a separate Rust service. This plugin only talks to its optional local API (`[api]`, bot v0.6.1+):

- **See**: status, hosts, active alerts, recent activity, and (read-only) what the bot may read and restart.
- **Restrict**: turn a registered operation off or on, mute notifications for 1, 8 or 24 hours, acknowledge alerts. The plugin can never add permissions: the bot's TOML stays the ceiling.
- **Request**: ask for a registered operation. Safe ones run; destructive ones send a preview to Telegram and wait for the confirmation tap there. Nothing runs from this plugin on its own.

## Set up

1. In the bot's config enable the API: `[api] enabled = true`, `bind = "127.0.0.1:8787"`, `token_file = "/run/credentials/dexter-ops.service/api-token"` with `LoadCredential=api-token:/etc/dexter-ops/api-token` in the service (a random token of 32+ characters; see the bot's `docs/SECURITY.md`). Restart the bot.
2. If Termix runs in a container, bind the bot to the Docker bridge IP instead and allow only that network in the firewall.
3. Install the `.tmxplug` (Plugins → Install from file, Plugin developer mode on), then open Plugins → Dexter Ops → Settings and set **Bot address** and **API token**.
4. Only admins get the `dexter-ops.manage` permission by default.

## Security

Capabilities are `network:outbound`, `network:serve` and `ui:surface`. Requests go only to the configured origin (the one host allowed to be private or loopback); redirects are refused; the token is a secret setting and never appears in a response, an error or an audit line. The routes are an explicit allowlist: there is no generic proxy, no route that edits the policy and none that runs a command.

## Develop

`npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run validate`, `npm run pack`. The package is standalone (not a root workspace).
