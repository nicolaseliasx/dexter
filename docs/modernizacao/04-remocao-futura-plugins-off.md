# Removing the plugins that are Off

Decision: when moving to Termix 26.10.6, plugins that are not used are set to **Off**, not Remove. Remove deletes the plugin and its data, cannot be undone without a registry, and an Off plugin loads no code and mounts no routes, so the runtime risk is the same. Remove only after a period of use without missing the plugin.

## Off today (14)
Serial, File Manager, Tunnels, Snippets, Usage Statistics, Sync, Single sign-on, Remote Desktop, Docker, Alerts, Host Metrics, Import and Export, Credential Tools, Passkeys.

On (7 plus own plugins): SSH Terminal, Proxmox, Host Status, TOTP, Workspaces, Classic Layout, Classic Themes, and `sessions` (`plugins/sessions`).

## When to remove
- After a few weeks of use on the promoted instance without turning the plugin back on.
- Suggested order (no data of their own, largest surface first): Remote Desktop, SSO, Passkeys, Sync, Usage Statistics. The rest (Snippets, Tunnels, Alerts, File Manager, Docker, Host Metrics, Import/Export, Credential Tools, Serial) only after checking for data.

## Checklist before each Remove
1. Check whether the plugin holds data on the instance, and export what exists.
2. Back up the volume with the service stopped.
3. Try the Remove on a copy first and see whether the plugin returns on the next boot or upgrade (log line `Registered bundled plugin ...`); if it does, keep it Off.
4. Confirm that login, Hosts, Credentials, SSH and Sessions still work.

The `minimal` image variant (appearance plugins only) would need SSH Terminal and Proxmox installed on top; not adopted.
