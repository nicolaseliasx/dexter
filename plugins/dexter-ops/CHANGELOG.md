# Changelog

## 0.1.1

Needs the bot v0.6.1 or newer; an older bot is shown as not compatible.

### Fixed

- Muting notifications now has a duration (1, 8 or 24 hours) and shows when it ends; before, a mute never expired and alerts raised during it were lost.
- The address of a bot on IPv6 is now accepted by the outbound check.
- A double click can no longer send the same request or acknowledgement twice, and the panel stops polling while the tab is hidden.

### Added

- Saving the settings checks the bot address and the token length, with a message on the field.
- The bot's audit log now records which D.EX.T.E.R. user made each change.
- The bot's rate limit on repeated requests is reported as a clear error.

## 0.1.0

### Added

- Panel with the bot status, hosts, registered operations, active alerts, a read-only view of what the bot may do, and recent activity.
- Turn a registered operation off or on, mute Telegram notifications and acknowledge alerts. Every change is audited.
- Request an operation from the panel. Destructive operations only send a preview to Telegram and still wait for the confirmation there.
