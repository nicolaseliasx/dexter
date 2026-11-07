import { describe, expect, it } from "vitest";
import { normalizeUrl, suggestions, validateCard } from "../../src/catalog";

describe("application catalog", () => {
  it("accepts only HTTP(S) addresses and normalizes them", () => {
    expect(normalizeUrl(" https://example.com ")).toBe("https://example.com/");
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeUrl("https://user:secret@example.com")).toThrow();
  });

  it("deduplicates discovered addresses against saved cards and each other", () => {
    expect(
      suggestions(
        ["https://example.com/"],
        [
          "https://example.com",
          "https://other.example",
          "https://other.example/",
          "invalid",
        ],
      ),
    ).toEqual(["https://other.example/"]);
  });

  it("validates and normalizes editable card fields", () => {
    expect(
      validateCard({
        name: " App ",
        url: "https://example.com",
        description: " test ",
        icon: " A ",
        color: "#abcdef",
        order: 2,
      }),
    ).toEqual({
      name: "App",
      url: "https://example.com/",
      description: "test",
      icon: "A",
      color: "#abcdef",
      order: 2,
    });
    expect(() =>
      validateCard({ name: " ", url: "https://example.com" }),
    ).toThrow();
    expect(() =>
      validateCard({
        name: "A",
        url: "https://example.com",
        color: "red; color:blue",
      }),
    ).toThrow();
    expect(() =>
      validateCard({ name: "A", url: "file:///etc/passwd" }),
    ).toThrow();
  });
});
