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

it("uses pinned CA and bearer token for the fixed private collector", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { name: "A", source: "cloudflare", url: "https://example.com" },
          ],
          unavailable: [],
          collected_at: Math.floor(Date.now() / 1000),
        }),
      ),
    );
  const result = await fetchInventory(fetch, "token-value", "certificate", []);
  expect(fetch).toHaveBeenCalledWith(
    "https://192.168.15.40:18443/inventory",
    expect.objectContaining({
      headers: { Authorization: "Bearer token-value" },
      allowPrivateHosts: ["192.168.15.40"],
      tls: { ca: "certificate" },
    }),
  );
  expect(result.items).toHaveLength(1);
  await expect(fetchInventory(fetch, "", "certificate", [])).rejects.toThrow();
});
