import { describe, expect, it } from "vitest";
import { BotError, createBotClient, parseBotUrl } from "../../src/backend/client.js";

const TOKEN = "secret-token-0123456789abcdef0123456789";

function make(options: {
  botUrl?: unknown;
  token?: unknown;
  reply?: () => Response | Promise<Response>;
}) {
  const calls: { url: string; init?: Record<string, unknown> }[] = [];
  const client = createBotClient({
    config: async () => ({
      botUrl: "botUrl" in options ? options.botUrl : "http://172.17.0.1:8787",
      token: "token" in options ? options.token : TOKEN,
    }),
    fetch: async (url, init) => {
      calls.push({ url, init: init as never });
      if (!options.reply) return Response.json({ ok: true });
      return options.reply();
    },
  });
  return { client, calls };
}

describe("parseBotUrl", () => {
  it("accepts a plain http or https origin", () => {
    expect(parseBotUrl("http://127.0.0.1:8787").hostname).toBe("127.0.0.1");
    expect(parseBotUrl("https://bot.lan:8443/").origin).toBe("https://bot.lan:8443");
  });
  it("refuses credentials, other schemes, paths and queries", () => {
    for (const bad of ["ftp://x", "http://u:p@x", "http://x/v1", "http://x/?a=1", "x", ""]) {
      expect(() => parseBotUrl(bad), bad).toThrow(BotError);
    }
  });
});

describe("bot client", () => {
  it("calls only the configured host, with the bearer token and that exact private host allowed", async () => {
    const { client, calls } = make({});
    await client.request("GET", "/v1/status");
    expect(calls[0].url).toBe("http://172.17.0.1:8787/v1/status");
    const init = calls[0].init as { headers: Record<string, string>; allowPrivateHosts: string[]; method: string };
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.allowPrivateHosts).toEqual(["172.17.0.1"]);
    expect(init.method).toBe("GET");
  });

  it("sends JSON bodies", async () => {
    const { client, calls } = make({});
    await client.request("PUT", "/v1/ops/restart-nginx", { enabled: false });
    const init = calls[0].init as { body: string; headers: Record<string, string> };
    expect(init.body).toBe('{"enabled":false}');
    expect(init.headers["content-type"]).toBe("application/json");
  });

  it("refuses to run before it is configured", async () => {
    for (const cfg of [{ botUrl: "" }, { token: "" }, { botUrl: undefined }]) {
      const { client, calls } = make(cfg);
      await expect(client.request("GET", "/v1/status")).rejects.toMatchObject({ code: "NOT_CONFIGURED", status: 409 });
      expect(calls).toHaveLength(0);
    }
  });

  it("maps failures to stable errors and never leaks the token", async () => {
    const down = make({ reply: () => Promise.reject(new Error(`connect ECONNREFUSED ${TOKEN}`)) });
    const err = await down.client.request("GET", "/v1/status").catch((e: unknown) => e as BotError);
    expect(err).toMatchObject({ code: "BOT_UNREACHABLE", status: 502 });
    expect(String((err as Error).message)).not.toContain(TOKEN);

    const denied = make({ reply: () => new Response("{}", { status: 401 }) });
    await expect(denied.client.request("GET", "/v1/status")).rejects.toMatchObject({ code: "BOT_REJECTED_TOKEN", status: 502 });

    const missing = make({ reply: () => Response.json({ error: "not_found" }, { status: 404 }) });
    await expect(missing.client.request("PUT", "/v1/ops/x", { enabled: true })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    const conflict = make({ reply: () => Response.json({ error: "operation_disabled" }, { status: 409 }) });
    await expect(conflict.client.request("POST", "/v1/ops/x/request")).rejects.toMatchObject({ code: "OPERATION_DISABLED", status: 409 });

    const junk = make({ reply: () => new Response("<html>", { status: 200 }) });
    await expect(junk.client.request("GET", "/v1/status")).rejects.toMatchObject({ code: "BOT_BAD_RESPONSE", status: 502 });
  });
});
