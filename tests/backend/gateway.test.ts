import { describe, expect, it, vi } from "vitest";
import { SshSessionGateway } from "../../src/backend/gateway.js";
import { PersistentSessionError } from "../../src/backend/errors.js";

const host = { id: 7, actingUserId: "u1" };
const ok = (stdout = "") => ({ stdout, stderr: "", code: 0, truncated: false, timedOut: false });

describe("SshSessionGateway", () => {
  it("runs the tmux command through ctx.ssh.exec with the PATH prefix and a background profile", async () => {
    const exec = vi.fn(async () => ok(""));
    const gateway = new SshSessionGateway({ exec } as never);
    await gateway.list(host);
    expect(exec).toHaveBeenCalledTimes(1);
    const [hostId, command, options] = exec.mock.calls[0] as unknown as [number, string, Record<string, unknown>];
    expect(hostId).toBe(7);
    expect(command).toMatch(/^\/bin\/sh -c '.*PATH=\/opt\/homebrew\/bin:.*tmux/s);
    expect(options).toMatchObject({ purpose: "persistent-sessions", profile: "background" });
  });

  it("returns stdout of a successful list parsed into sessions", async () => {
    const exec = vi.fn(async () => ok(""));
    const gateway = new SshSessionGateway({ exec } as never);
    expect(await gateway.list(host)).toEqual([]);
  });

  it("maps connection failures and non-zero exits without output to REMOTE_UNAVAILABLE", async () => {
    const failing = new SshSessionGateway({ exec: vi.fn(async () => { throw new Error("connect failed"); }) } as never);
    await expect(failing.list(host)).rejects.toMatchObject({ code: "PERSISTENT_SESSION_REMOTE_UNAVAILABLE" });
    const badExit = new SshSessionGateway({
      exec: vi.fn(async () => ({ stdout: "", stderr: "boom", code: 1, truncated: false, timedOut: false })),
    } as never);
    await expect(badExit.kill(host, "x", "id")).rejects.toBeInstanceOf(PersistentSessionError);
  });

  it("treats a timed-out command as unavailable", async () => {
    const timedOut = new SshSessionGateway({
      exec: vi.fn(async () => ({ stdout: "", stderr: "", code: null, truncated: false, timedOut: true })),
    } as never);
    await expect(timedOut.list(host)).rejects.toMatchObject({ code: "PERSISTENT_SESSION_REMOTE_UNAVAILABLE" });
  });

  it("runs the command as the acting user through the runAs wrapper", async () => {
    const exec = vi.fn(async () => ok(""));
    const runAs = vi.fn(async (_userId: string, fn: () => Promise<unknown>) => fn());
    const gateway = new SshSessionGateway({ exec } as never, runAs as never);
    await gateway.list(host);
    expect(runAs).toHaveBeenCalledWith("u1", expect.any(Function));
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
