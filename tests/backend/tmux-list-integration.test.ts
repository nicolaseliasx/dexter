import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildPersistentTmuxListCommand,
  parsePersistentTmuxList,
} from "../../src/backend/tmux-adapter.js";

describe.skipIf(spawnSync("tmux", ["-V"]).status !== 0)(
  "tmux integration",
  () => {
    let socketDir: string;
    let environment: NodeJS.ProcessEnv;

    beforeAll(() => {
      socketDir = mkdtempSync(path.join(tmpdir(), "termix-tmux-test-"));
      environment = { ...process.env, TMUX_TMPDIR: socketDir };
      delete environment.TMUX;
      delete environment.LANG;
      delete environment.LANGUAGE;
      delete environment.LC_ALL;
      delete environment.LC_CTYPE;
      execFileSync("tmux", ["new-session", "-d", "-s", "fixture-session"], {
        env: environment,
        stdio: "ignore",
      });
      for (const [key, value] of [
        ["@termix_session_id", "fixture-id"],
        ["@termix_created_at", "2026-01-01T00:00:00.000Z"],
        ["@termix_expiry_mode", "manual"],
      ]) {
        execFileSync(
          "tmux",
          ["set-option", "-t", "fixture-session", key, value],
          {
            env: environment,
            stdio: "ignore",
          },
        );
      }
    });

    afterAll(() => {
      if (!socketDir) return;
      try {
        execFileSync("tmux", ["kill-session", "-t", "fixture-session"], {
          env: environment,
          stdio: "ignore",
        });
      } finally {
        rmSync(socketDir, { recursive: true, force: true });
      }
    });

    it("recognizes a marked session returned by a real tmux server", () => {
      const output = execFileSync(
        "sh",
        ["-c", buildPersistentTmuxListCommand()],
        {
          env: environment,
          encoding: "utf8",
        },
      );
      expect(parsePersistentTmuxList(output)).toEqual([
        expect.objectContaining({
          name: "fixture-session",
          marker: expect.objectContaining({
            id: "fixture-id",
            expiryMode: "manual",
          }),
        }),
      ]);
    });
  },
);
