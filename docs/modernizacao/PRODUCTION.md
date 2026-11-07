# Promoting a new image to production

Production is a single container and a data volume. A new image is promoted only with the owner's authorization, in a maintenance window.

## Current deployment (2026-11-07)

Production runs on LXC 101 (`192.168.15.41:8443`) with image
`termix:26.10.6-ncls.5` and compose file
`/home/admin/termix-migration/docker-compose.lxc.yml`.
It is built from `docker/Dockerfile` and bundles `ssh-terminal` 1.2.1-ncls.5
(terminal refits on resize even after a hidden start) and the generic
health-monitor correction. Sessions 0.2.8 is installed by upload and accepts
ssh-terminal ncls.1 to ncls.5.

The stopped-service backup is in `/home/admin/termix-migration/ncls5-20261107/`
in the LXC (root only). The rollback image is `termix:26.10.6-ncls.4` (still
loaded on the LXC); Sessions 0.2.8 stays compatible with it. To revert, restore
the previous image in the production compose file and run
`docker compose up -d --no-deps termix`; no schema migration was introduced.
Earlier deployments: `ncls4-20261107/` (`termix:26.10.6-ncls.4`) and
`resilience-20261104/` (`termix:resilience-20261104`) in the same directory.

Container recreation can spend several minutes in the entrypoint's recursive
ownership preparation on this LXC. Observe that process and allow up to ten
minutes for health during deployment; a two-minute deadline caused an early
rollback before the application started. A subsequent healthy state alone is
insufficient: verify the active image, published bundle, inventory and attaches.
See [power-loss recovery](./05-boot-recovery.md) for the tmux integration.

## Before

1. Build the image from `docker/Dockerfile` and test it on an `--internal` Docker network, with a **copy** of the data volume and a throwaway sshd/tmux (see [AGENTS.md](../../AGENTS.md)). Never point a test instance at real hosts.
2. On the copy: log in, open Hosts and Credentials, then run Create, Attach, Split, Rename and Terminate for Sessions. Check the plugin state: only the intended plugins On, none removed.
3. Make sure the bundled `ssh-terminal` is the only copy (no second one in `data/plugins`).

## Promote

1. Note the current image id and tag of the running container; that is the rollback target.
2. Stop the service, then back up the data volume **with the service stopped**. An online copy is not a consistent snapshot. Keep the backup private: it holds secrets.
3. Start the new image on the same volume.
4. Repeat the plugin onboarding if the instance is new (plugin on/off state lives in the database, not in the image).
5. Verify login, Hosts, Credentials, SSH and Sessions.

## Roll back

1. Stop the new container.
2. If the new image only read the data, start the previous image on the same volume.
3. If anything was written or migrated, restore the volume from the backup taken in step 2 first, then start the previous image.

## Upgrading from Termix 2.8 or older

The 26.10.6 image refuses a database from 2.8 or older ("Upgrade to Termix 2.9.1 and start it once"). Start a 2.9.x image once on the volume (the first start is slow: the entrypoint runs `chown -R`), wait until it is healthy, stop it, then start the 26.10.6 image. Rehearse both steps on a copy of the volume first.

## State after the 2026-11-02 cutover

At this original cutover production ran `termix:26.10.6-ncls.1`. The cold backup of the 2.8 data and the saved 2.8 image are kept outside the repository (`~/_tmp/20261102-cutover`). Because the migration is one-way, a rollback to 2.8 means restoring that backup into the volume and loading the saved image.

## Plugin-only updates (no new image)

A plugin that is not bundled (Sessions, Applications, Custom CSS) is updated from its `.tmxplug`, without touching the container. `ssh-terminal` is bundled, so it only changes with a new image.

1. `npm run build` then `npm run pack` in the plugin directory; unpack the `.tmxplug` and check that `manifest.json` has the version and `dist/` has the new code. Note the printed sha256.
2. Take a baseline (sessions list and hosts with auth type) through the API. Keep the previous `.tmxplug` for rollback.
3. Install with the `termix-manager` upload flow (`POST /plugins/upload`, check id, version and capabilities, then `POST /plugins/upload/<token>/install`). Plugin developer mode must be on.
4. Check `GET /plugins` (new version, `active`), `termix-manager health`, and the baseline again; a plugin update does not touch its data.
5. Roll back by installing the previous `.tmxplug` the same way.

## State on 2026-11-07

- Image `termix:26.10.6-ncls.4` (release [`v26.10.6-ncls.4`](https://github.com/nicolaseliasx/termix/releases/tag/v26.10.6-ncls.4)) was promoted on LXC 101 with `ncls4-promote-20261107.sh`, run as root through `pct exec 101` on the Proxmox host (the LXC `admin` has no root or Docker). It bundles `ssh-terminal` **1.2.1-ncls.4** and the health-monitor fix. The cold backup, `previous-image-id` and `compose-before.yml` are in `/home/admin/termix-migration/ncls4-20261107`; rollback is the previous image `termix:resilience-20261104`.
- Sessions **0.2.7** runs in production; release [`sessions-v0.2.7`](https://github.com/nicolaseliasx/termix/releases/tag/sessions-v0.2.7) carries it with Applications 0.6.0 and Custom CSS 0.1.0 and a `SHA256SUMS`.
- **Incident:** right after the promotion Sessions 0.2.6 went `blocked` (`requires "ssh-terminal" ... ncls.3, but 1.2.1-ncls.4 is installed`) and disappeared from the UI, because its manifest pins the exact `ssh-terminal` versions it accepts. Fixed by Sessions 0.2.7 (installed by upload, data intact). Before promoting an image that changes the bundled `ssh-terminal` version, check that `plugins/sessions/manifest.json` `dependencies` accepts it; a test now enforces this.
- Not measured: the browser effect of the tmux `sync` feature on Codex repaint, and the Sessions backend tests on this machine (they need `better-sqlite3` built for Node 24).
- Image `termix:26.10.6-ncls.5` was promoted on LXC 101 on 2026-11-07, with `ncls5-promote-20261107.sh` and a `ncls5-resume-20261107.sh` adjustment (the LXC `admin` has no root or Docker). It bundles `ssh-terminal` **1.2.1-ncls.5**; Sessions **0.2.8** was installed by upload first.
- **Incident:** the update was started from inside Termix (a terminal or Hosts session served by the container being replaced). Stopping the container cut that session in the middle of the promotion, and the rest had to be finished from the Proxmox host. Run a promotion only from the Proxmox console (`pct exec 101`) or another session that does not depend on Termix.
