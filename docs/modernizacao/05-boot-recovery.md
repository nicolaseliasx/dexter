# Recovery after power loss

The Termix host devhub uses tmux-resurrect/continuum. Restoring layout and
processes alone loses `@termix_*` session identity options. Sessions correctly
refuses attachment when its database UUID does not match the remote marker.
Do not bypass this check or silently adopt a session by name.

The authorized integration is [the marker helper](../../scripts/termix-tmux-markers.py)
and [the resurrect patch](../../scripts/tmux-resurrect-markers.patch).
`~/.tmux/termix-markers.py` links to this helper, selected with the tmux option
`@termix-marker-helper`. The patch is applied to the local resurrect scripts.
Reapply/check it when upgrading tmux-resurrect; keep an original-script backup.

During save, generation and markers are captured before and after layout dump.
Only unchanged identities are embedded as `termix-marker` records in the retained
snapshot. Changes solely to markers therefore also produce a new snapshot.
During restore, the snapshot path is fixed once. Only a successful `new-session`
may restore markers, using its returned immutable target and creation time.
Existing sessions and failed creations do not acquire saved identities.
The helper refuses to overwrite even partially populated markers.

Run `python3 scripts/test_termix_tmux_markers.py` after installing the patch.
The tests use an isolated socket and actual save/restore scripts, including
replacement during save, generation changes, conflicting identities, unchanged
layouts and a homonymous winner of a creation race. Never test restore on the
production tmux server. A real save is safe for verifying marker records.

On 2026-11-04 the owner authorized reassociating `cleanup` and `fix-performance`
after their markers were lost. Exact targets and generations were verified
before the guarded write; no session was killed or recreated.

The core health monitor now accepts structured plugin errors. Its regression
test preserves a session conflict without converting it into a TypeError or
database failure, while retaining real database/network degradation handling.
See [production deployment and rollback](./PRODUCTION.md).

## Cloudflare Access after WAN changes

The LAN bypass is refreshed by `cf-lan-bypass-sync.timer` on devhub.
`~/.local/bin/cf-tunnel` must not require retired Access applications: the
removed `devhub.ncls.cc` blocked all synchronization after the power loss.
Only that obsolete requirement was removed; other application/policy checks
still fail closed. The synchronizer permits 180 seconds for the helper's
Zero Trust inventory, protected backup and policy update (the successful run
took 37 seconds). WAN discovery retains its shorter timeouts and the existing
five-minute timer retries failures. Bypass remains limited to residential
IPv4 `/32` and IPv6 `/64`; Gateway authentication is unchanged.
