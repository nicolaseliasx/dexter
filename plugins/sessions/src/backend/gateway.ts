import type { PluginSsh } from "@termix-ssh/plugin-sdk/backend";
import { PersistentSessionError } from "./errors.js";
import {
  buildPersistentTmuxCreateCommand,
  buildPersistentTmuxFreezeCommand,
  buildPersistentTmuxKillByNameCommand,
  buildPersistentTmuxKillCommand,
  buildPersistentTmuxListCommand,
  buildPersistentTmuxMarkCommand,
  buildPersistentTmuxRenameCommand,
  buildPersistentTmuxThawCommand,
  parsePersistentTmuxList,
  shellQuote,
} from "./tmux-adapter.js";
import type { PersistentSessionExpiryMode, RemotePersistentSession } from "./types.js";

/** A host the lifecycle can reach, with the user it acts for. */
export type SessionHost = { id: number; actingUserId: string };

type SessionMarkInput = {
  name: string;
  id: string;
  createdAt: string;
  expiryMode: PersistentSessionExpiryMode;
  expirySeconds?: number;
};

export interface PersistentSessionGateway {
  list(host: SessionHost, options?: { timeoutMs?: number }): Promise<RemotePersistentSession[]>;
  create(host: SessionHost, input: SessionMarkInput): Promise<void>;
  mark(host: SessionHost, input: SessionMarkInput): Promise<void>;
  rename(host: SessionHost, input: { oldName: string; newName: string; id: string }): Promise<void>;
  kill(host: SessionHost, name: string, id: string): Promise<void>;
  /** Kills by name only while the remote session has no ownership marker. */
  killUnguarded(host: SessionHost, name: string): Promise<void>;
  freeze(host: SessionHost, name: string): Promise<void>;
  thaw(host: SessionHost, name: string): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Runs `fn` as the given user. Routes already run as the caller; timers need ctx.asUser. */
export type RunAs = <T>(userId: string, fn: () => Promise<T>) => Promise<T>;
const runAsSelf: RunAs = (_userId, fn) => fn();

/** Runs the tmux commands over the host's SSH login, through the plugin SDK. */
export class SshSessionGateway implements PersistentSessionGateway {
  constructor(
    private readonly ssh: Pick<PluginSsh, "exec">,
    private readonly runAs: RunAs = runAsSelf,
  ) {}

  private async execute(host: SessionHost, command: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
    const script = `PATH=/opt/homebrew/bin:/usr/local/bin:/opt/bin:/usr/pkg/bin:"$PATH"; export PATH; ${command}`;
    let result;
    try {
      result = await this.runAs(host.actingUserId, () =>
        this.ssh.exec(host.id, `/bin/sh -c ${shellQuote(script)}`, {
          purpose: "persistent-sessions",
          profile: "background",
          timeoutMs,
        }),
      );
    } catch {
      throw new PersistentSessionError("PERSISTENT_SESSION_REMOTE_UNAVAILABLE");
    }
    if (result.timedOut) throw new PersistentSessionError("PERSISTENT_SESSION_REMOTE_UNAVAILABLE");
    const stdout = result.stdout.trim();
    if (result.code !== 0 && !stdout) throw new PersistentSessionError("PERSISTENT_SESSION_REMOTE_UNAVAILABLE");
    return stdout;
  }

  async list(host: SessionHost, options?: { timeoutMs?: number }): Promise<RemotePersistentSession[]> {
    return parsePersistentTmuxList(await this.execute(host, buildPersistentTmuxListCommand(), options?.timeoutMs));
  }
  async create(host: SessionHost, input: SessionMarkInput): Promise<void> {
    await this.execute(host, buildPersistentTmuxCreateCommand(input));
  }
  async mark(host: SessionHost, input: SessionMarkInput): Promise<void> {
    await this.execute(host, buildPersistentTmuxMarkCommand(input));
  }
  async rename(host: SessionHost, input: { oldName: string; newName: string; id: string }): Promise<void> {
    await this.execute(host, buildPersistentTmuxRenameCommand(input));
  }
  async kill(host: SessionHost, name: string, id: string): Promise<void> {
    await this.execute(host, buildPersistentTmuxKillCommand(name, id));
  }
  async killUnguarded(host: SessionHost, name: string): Promise<void> {
    await this.execute(host, buildPersistentTmuxKillByNameCommand(name));
  }
  async freeze(host: SessionHost, name: string): Promise<void> {
    await this.execute(host, buildPersistentTmuxFreezeCommand(name));
  }
  async thaw(host: SessionHost, name: string): Promise<void> {
    await this.execute(host, buildPersistentTmuxThawCommand(name));
  }
}
