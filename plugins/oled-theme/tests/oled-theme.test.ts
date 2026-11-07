import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
const theme = manifest.contributes.themes[0];
const css = fs.readFileSync(path.join(root, theme.css), "utf8");

/** Value of a custom property declared inside the `.oled` rule. */
function token(name: string): string | undefined {
  const block = css.match(/\.oled\s*\{([^}]*)\}/)?.[1] ?? "";
  return block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("oled theme", () => {
  it("is a dark theme whose id matches the CSS scope", () => {
    expect(theme.id).toBe("oled");
    expect(theme.mode).toBe("dark");
    expect(manifest.capabilities).toEqual(["ui:theme"]);
  });

  it("paints the workspace and the terminal pure black", () => {
    expect(token("background")).toBe("#000000");
    expect(token("terminal-bg")).toBe("#000000");
    expect(theme.swatch.background).toBe("#000000");
  });

  it("keeps panels distinguishable from the workspace", () => {
    for (const name of ["sidebar", "card", "popover", "surface"]) {
      expect(token(name), name).toMatch(/^#0[0-9a-f]0[0-9a-f]0[0-9a-f]$/i);
      expect(token(name), name).not.toBe("#000000");
    }
    expect(token("border")).toBeDefined();
    expect(token("sidebar-border")).toBeDefined();
  });

  it("keeps hover/selected states visible against black", () => {
    for (const name of ["accent", "sidebar-accent", "muted", "secondary"]) {
      expect(token(name), name).toBeDefined();
      expect(token(name), name).not.toBe("#000000");
    }
  });

  it("defines every token the dark theme defines", () => {
    const index = fs.readFileSync(
      path.resolve(root, "../../src/ui/index.css"),
      "utf8",
    );
    const dark = index.match(/\n\.dark\s*\{([^}]*)\}/)?.[1] ?? "";
    const wanted = [...dark.matchAll(/--([\w-]+):/g)].map((m) => m[1]);
    expect(wanted.length).toBeGreaterThan(20);
    expect(wanted.filter((name) => token(name) === undefined)).toEqual([]);
  });
});
