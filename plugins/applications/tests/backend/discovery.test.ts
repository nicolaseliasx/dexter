import { expect, it, vi } from "vitest";
import {
  fetchInventory,
  filterInventory,
  readLimitedJson,
} from "../../src/discovery";

it("filters duplicates and rejects untrusted addresses while preserving services without URLs", () => {
  const result = filterInventory(
    {
      items: [
        { name: "Existing", source: "cloudflare", url: "https://example.com" },
        { name: "New", source: "cloudflare", url: "https://new.example" },
        { name: "Again", source: "cloudflare", url: "https://new.example/" },
        { name: "Unsafe", source: "cloudflare", url: "javascript:alert(1)" },
        { name: "Service", source: "systemd", url: null },
      ],
      unavailable: [],
    },
    ["https://example.com/"],
  );
  expect(result.items).toEqual([
    { name: "New", source: "cloudflare", url: "https://new.example/" },
    { name: "Service", source: "systemd", url: null },
  ]);
});

it("stops reading an oversized collector response", async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    }),
  );
  await expect(readLimitedJson(response, 10)).rejects.toThrow(
    "Inventory too large",
  );
});

it("marks stale or missing snapshots as unavailable", () => {
  expect(
    filterInventory({ items: [], unavailable: [], collected_at: 1 }, [])
      .unavailable,
  ).toContain("stale");
  expect(
    filterInventory({ items: [], unavailable: [] }, []).unavailable,
  ).toContain("stale");
});

const collector = {
  url: "https://collector.example.test:18443",
  token: "token-value",
  ca: "certificate",
};
const snapshot = () =>
  new Response(
    JSON.stringify({
      items: [{ name: "A", source: "cloudflare", url: "https://example.com" }],
      unavailable: [],
      collected_at: Math.floor(Date.now() / 1000),
    }),
  );

it("uses the configured collector with the pinned CA and bearer token", async () => {
  const fetch = vi.fn().mockResolvedValue(snapshot());
  const result = await fetchInventory(fetch, collector, []);
  expect(fetch).toHaveBeenCalledWith(
    "https://collector.example.test:18443/inventory",
    expect.objectContaining({
      headers: { Authorization: "Bearer token-value" },
      allowPrivateHosts: ["collector.example.test"],
      tls: { ca: "certificate" },
    }),
  );
  expect(result.items).toHaveLength(1);
});

it.each([
  ["no token", { ...collector, token: "" }],
  ["no CA", { ...collector, ca: "" }],
  ["no URL", { ...collector, url: "" }],
  [
    "a plain http URL",
    { ...collector, url: "http://collector.example.test:18443" },
  ],
  [
    "credentials in the URL",
    { ...collector, url: "https://user:pass@collector.example.test" },
  ],
  ["a URL that is not a URL", { ...collector, url: "collector" }],
])("refuses to call the collector with %s", async (_label, config) => {
  const fetch = vi.fn().mockResolvedValue(snapshot());
  await expect(fetchInventory(fetch, config, [])).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
