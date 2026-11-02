# Plugin matrix, Termix 26.10.6

Source: `docker/bundled-plugins.json` at tag `v26.10.6`. The version is the one in the bundled manifest; it is not proof of what is installed or running. "Evaluate" never authorizes turning off authentication or a feature in use. Dependencies, existing data and downgrade behavior must be confirmed on the migrated instance before any action.

| Plugin id | Version | Image set | Initial decision |
|---|---|---|---|
| acme-ssl | v1.1.0 | full | Turn off after review |
| ai | v1.3.0 | full | Turn off after review |
| alerts | v1.2.0 | standard | Evaluate |
| audit-tools | v1.0.0 | full | Turn off after review |
| automations | v1.2.0 | full | Turn off after review |
| classic-layout | v1.1.0 | minimal | Keep |
| classic-themes | v1.0.0 | minimal | Keep |
| cloud-providers | v1.1.0 | full | Turn off after review |
| credential-tools | v1.0.0 | standard | Evaluate |
| databases | v1.1.1 | full | Turn off after review |
| docker | v1.2.2 | standard | Evaluate |
| file-manager | v1.1.2 | standard | Turn off after review |
| fleets | v1.1.0 | full | Turn off after review |
| homepage | v1.1.0 | full | Evaluate |
| host-metrics | v1.3.0 | standard | Evaluate |
| host-status | v1.0.0 | standard | Keep |
| hosts-config | v1.0.0 | full | Turn off after review |
| import-export | v1.0.1 | standard | Evaluate |
| kubernetes | v1.0.1 | full | Turn off after review |
| ldap | v1.0.2 | full | Turn off after review |
| login-security | v1.0.0 | full | Evaluate |
| network-topology | v1.0.2 | full | Turn off after review |
| opkssh | v1.0.2 | full | Turn off after review |
| proxmox | v1.2.0 | full | Install, leave unconfigured |
| remote-desktop | v1.3.0 | standard | Evaluate |
| reverse-proxy | v1.1.0 | full | Turn off after review |
| samba | v1.0.0 | full | Turn off after review |
| secret-sources | v1.1.0 | full | Turn off after review |
| serial | v1.0.2 | standard | Turn off after review |
| service-manager | v1.1.1 | full | Evaluate |
| session-recording | v1.1.0 | full | Turn off after review |
| session-sharing | v1.1.0 | full | Turn off after review |
| simple-layout | v1.0.1 | full | Evaluate |
| snippets | v1.2.0 | standard | Turn off after review |
| ssh-terminal | v1.2.0 | standard | Keep |
| sso | v1.0.4 | standard | Turn off after review |
| step-ca | v1.0.2 | full | Turn off after review |
| sync | v1.1.0 | standard | Evaluate |
| tailscale | v1.1.0 | full | Turn off after review |
| telemetry | v1.0.2 | standard | Turn off after review |
| termix-identity | v1.0.2 | full | Turn off after review |
| tmux-monitor | v1.1.0 | full | Evaluate |
| totp | v1.0.2 | standard | Evaluate |
| tunnels | v1.2.2 | standard | Turn off after review |
| vault | v1.0.2 | full | Turn off after review |
| wake-on-lan | v1.1.0 | full | Turn off after review |
| warpgate | v1.0.2 | full | Turn off after review |
| web-endpoint | v1.1.0 | full | Evaluate |
| webauthn | v1.2.0 | standard | Evaluate |
| workspaces | v1.1.0 | standard | Evaluate |

The `minimal` image variant contains only the appearance plugins; it has no SSH Terminal and no Proxmox. A migration may bring back plugins that were enabled before.

Community plugins considered: Command Editor, Container Files, Herdr, Host Icons, NetBird, Proxmox Power and Remote VS Code. Ids, versions, availability and dependencies are not verified; if present, turn them off after review without deleting data.

`proxmox` has credential access and SSH connection capabilities: inspect its permissions and keep discovery, sync, metrics, hosts and Proxmox credentials inactive until it is configured on purpose.
