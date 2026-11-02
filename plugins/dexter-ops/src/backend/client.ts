/** Stable, token-free errors for everything that can go wrong talking to the bot. */
export class BotError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "BotError";
  }
}

export interface BotSettings {
  botUrl?: unknown;
  token?: unknown;
}

export interface BotClientDeps {
  config: () => Promise<BotSettings>;
  fetch: (url: string, init?: Record<string, unknown>) => Promise<Response>;
}

const TIMEOUT_MS = 10_000;

/** The bot's origin only: http(s), no credentials, no path, no query. */
export function parseBotUrl(raw: unknown): URL {
  if (typeof raw !== "string" || !raw.trim()) throw new BotError("NOT_CONFIGURED", 409);
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BotError("INVALID_BOT_URL", 409);
  }
  const plain = (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  if (!plain || url.pathname !== "/" || url.search || url.hash) throw new BotError("INVALID_BOT_URL", 409);
  return url;
}

const UPSTREAM_ERRORS: Record<number, [string, number]> = {
  400: ["BAD_REQUEST", 400],
  404: ["NOT_FOUND", 404],
  409: ["OPERATION_DISABLED", 409],
};

export function createBotClient(deps: BotClientDeps) {
  return {
    async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
      const cfg = await deps.config();
      const token = typeof cfg.token === "string" ? cfg.token.trim() : "";
      if (!token) throw new BotError("NOT_CONFIGURED", 409);
      const base = parseBotUrl(cfg.botUrl);

      const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
      if (body !== undefined) headers["content-type"] = "application/json";

      let res: Response;
      try {
        res = await deps.fetch(new URL(path, base).toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          timeoutMs: TIMEOUT_MS,
          // Only the one host the admin configured may be private/loopback.
          allowPrivateHosts: [base.hostname],
        });
      } catch {
        // Never forward the underlying message: it can carry the URL or the token.
        throw new BotError("BOT_UNREACHABLE", 502);
      }

      if (res.status === 401) throw new BotError("BOT_REJECTED_TOKEN", 502);
      const known = UPSTREAM_ERRORS[res.status];
      if (!res.ok) {
        if (known) throw new BotError(known[0], known[1]);
        throw new BotError("BOT_ERROR", 502);
      }
      try {
        return (await res.json()) as T;
      } catch {
        throw new BotError("BOT_BAD_RESPONSE", 502);
      }
    },
  };
}

export type BotRequest = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;
