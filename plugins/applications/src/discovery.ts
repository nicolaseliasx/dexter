import { normalizeUrl } from "./catalog.js";
import type { PluginFetch } from "@termix-ssh/plugin-sdk/backend";
export type Suggestion = { name: string; source: string; url: string | null };
export async function fetchInventory(
  fetch: PluginFetch,
  token: string | undefined,
  ca: string | undefined,
  saved: string[],
) {
  if (!token || !ca) throw new Error("Collector not configured");
  const response = await fetch("https://192.168.15.40:18443/inventory", {
    headers: { Authorization: `Bearer ${token}` },
    allowPrivateHosts: ["192.168.15.40"],
    tls: { ca },
    timeoutMs: 5000,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Collector unavailable");
  return filterInventory(await readLimitedJson(response), saved);
}
export async function readLimitedJson(
  response: Response,
  limit = 1_000_000,
): Promise<unknown> {
  if (!response.body) throw new Error("Empty inventory");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Inventory too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(data));
}
export function filterInventory(
  input: unknown,
  saved: string[],
): { items: Suggestion[]; unavailable: string[]; collected_at?: number } {
  if (!input || typeof input !== "object") throw new Error("Invalid inventory");
  const data = input as Record<string, unknown>;
  if (
    !Array.isArray(data.items) ||
    !Array.isArray(data.unavailable) ||
    data.items.length > 5000
  )
    throw new Error("Invalid inventory");
  const seen = new Set<string>();
  for (const url of saved) {
    try {
      seen.add(normalizeUrl(url));
    } catch {}
  }
  const items: Suggestion[] = [];
  for (const entry of data.items) {
    if (!entry || typeof entry !== "object") continue;
    const { name, source, url } = entry as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !["cloudflare", "systemd", "docker"].includes(String(source))
    )
      continue;
    if (url !== null && typeof url !== "string") continue;
    let normalized: string | null = null;
    if (typeof url === "string") {
      try {
        normalized = normalizeUrl(url);
      } catch {
        continue;
      }
      if (seen.has(normalized)) continue;
      seen.add(normalized);
    }
    items.push({ name, source: String(source), url: normalized });
  }
  const unavailable = data.unavailable
    .filter((x): x is string => typeof x === "string" && x.length <= 50)
    .slice(0, 20);
  const age =
    typeof data.collected_at === "number"
      ? Date.now() / 1000 - data.collected_at
      : Infinity;
  if (!Number.isFinite(age) || age > 300 || age < -60)
    unavailable.push("stale");
  return {
    items,
    unavailable,
    ...(typeof data.collected_at === "number"
      ? { collected_at: data.collected_at }
      : {}),
  };
}
