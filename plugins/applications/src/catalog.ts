export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid application URL");
  }
  return url.href;
}

export function suggestions(saved: string[], discovered: string[]): string[] {
  const seen = new Set<string>();
  for (const value of saved) {
    try {
      seen.add(normalizeUrl(value));
    } catch {
      /* Ignore invalid stored addresses. */
    }
  }
  const result: string[] = [];
  for (const value of discovered) {
    try {
      const url = normalizeUrl(value);
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    } catch {
      /* Discovery can contain entries without usable URLs. */
    }
  }
  return result;
}

export interface CardInput {
  name: string;
  url: string;
  description: string;
  icon: string;
  color: string;
  order: number;
}

export function validateCard(input: unknown): CardInput {
  if (!input || typeof input !== "object") throw new Error("Invalid card");
  const value = input as Record<string, unknown>;
  const field = (key: string, max: number, fallback = "") => {
    const raw = value[key] ?? fallback;
    if (typeof raw !== "string" || raw.trim().length > max)
      throw new Error(`Invalid ${key}`);
    return raw.trim();
  };
  const name = field("name", 100);
  if (!name) throw new Error("Invalid name");
  const url = normalizeUrl(field("url", 2048));
  const description = field("description", 500);
  const icon = field("icon", 8);
  const color = field("color", 7, "#888888");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Invalid color");
  const order = value.order ?? 0;
  if (!Number.isSafeInteger(order) || Math.abs(order as number) > 1000000)
    throw new Error("Invalid order");
  return { name, url, description, icon, color, order: order as number };
}
