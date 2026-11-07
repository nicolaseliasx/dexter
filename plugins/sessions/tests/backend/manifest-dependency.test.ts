import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function manifest(plugin: string) {
  return JSON.parse(
    readFileSync(resolve(__dirname, `../../../${plugin}/manifest.json`), "utf8"),
  ) as { version: string; dependencies?: Record<string, string> };
}

describe("manifest dependencies", () => {
  it("accepts the ssh-terminal version bundled in this repository", () => {
    const accepted = (manifest("sessions").dependencies?.["ssh-terminal"] ?? "")
      .split("||")
      .map((v) => v.trim());
    expect(accepted).toContain(manifest("ssh-terminal").version);
  });
});
