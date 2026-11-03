import { describe, expect, it, vi } from "vitest";
import {
  resolveManagedSession,
  managedTmuxAttachCommand,
} from "../../../src/frontend/terminal/managed-session";

describe("managed tmux reconnection", () => {
  it("resolves again for every connection instead of reusing a name", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ name: "old", target: "$7" })
      .mockResolvedValueOnce({ name: "renamed", target: "$7" });
    expect(await resolveManagedSession("s1", 1, invoke)).toEqual({
      name: "old",
      target: "$7",
    });
    expect(await resolveManagedSession("s1", 1, invoke)).toEqual({
      name: "renamed",
      target: "$7",
    });
    expect(invoke).toHaveBeenCalledWith("sessions.resolveAttachment", "s1", 1);
  });
  it("attaches by immutable target and checks the marker inside tmux, never by reused name", () => {
    const command = managedTmuxAttachCommand("$7", "session-id");
    expect(command).toContain("exec tmux if-shell -F -t '$7'");
    expect(command).toContain("#{==:#{@termix_session_id},session-id}");
    expect(command).toContain("attach-session -t $7");
    expect(() => managedTmuxAttachCommand("new-name", "session-id")).toThrow();
    expect(() => managedTmuxAttachCommand("$7", "x,#{bad}")).toThrow();
  });
  it("refuses attachment when the owning plugin or session is missing", async () => {
    await expect(resolveManagedSession("s1", 1, vi.fn())).rejects.toThrow();
    await expect(
      resolveManagedSession(
        "s1",
        1,
        vi.fn().mockRejectedValue(new Error("ended")),
      ),
    ).rejects.toThrow("ended");
  });
});
