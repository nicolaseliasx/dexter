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
const MIN_TOKEN_LEN = 32;

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
  429: ["TOO_MANY_REQUESTS", 429],
};

/** Same shape the bot accepts for `x-actor`. */
const ACTOR = /^[A-Za-z0-9_.@-]{1,64}$/;

/** What a settings save is checked against; returns field key to message. */
export function validateBotSettings(values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  const url = values.botUrl;
  if (typeof url === "string" && url.trim()) {
    try {
      parseBotUrl(url);
    } catch {
      errors.botUrl = "Use only the bot's origin, like http://127.0.0.1:8787 (http or https, no path or credentials).";
    }
  }
  const token = values.token;
  // An untouched secret comes back as { set: true }; only a typed value is checked.
  if (typeof token === "string" && token.trim() && token.trim().length < MIN_TOKEN_LEN) {
    errors.token = `The token must have at least ${MIN_TOKEN_LEN} characters.`;
  }
  return errors;
}

export function createBotClient(deps: BotClientDeps) {
  return {
    async request<T = unknown>(method: string, path: string, body?: unknown, actor?: string): Promise<T> {
      const cfg = await deps.config();
      const token = typeof cfg.token === "string" ? cfg.token.trim() : "";
      if (!token) throw new BotError("NOT_CONFIGURED", 409);
      const base = parseBotUrl(cfg.botUrl);

      const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
      if (body !== undefined) headers["content-type"] = "application/json";
      if (actor && ACTOR.test(actor)) headers["x-actor"] = actor;

      let res: Response;
      try {
        res = await deps.fetch(new URL(path, base).toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          timeoutMs: TIMEOUT_MS,
          // Only the one host the admin configured may be private/loopback.
          // Core compares the bare address, without the brackets of an IPv6 literal.
          allowPrivateHosts: [base.hostname.replace(/^\[|\]$/g, "")],
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

export type BotRequest = <T = unknown>(method: string, path: string, body?: unknown, actor?: string) => Promise<T>;
