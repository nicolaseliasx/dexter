# Promoting a new image to production

Production is a single container and a data volume. A new image is promoted only with the owner's authorization, in a maintenance window.

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
