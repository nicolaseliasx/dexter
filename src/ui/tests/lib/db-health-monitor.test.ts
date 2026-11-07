import { beforeEach, describe, expect, it } from "vitest";
import { dbHealthMonitor } from "@/lib/db-health-monitor";

describe("database health error classification", () => {
  beforeEach(() => dbHealthMonitor.reset());

  it("preserves a structured session conflict without throwing or reporting degradation", () => {
    expect(() =>
      dbHealthMonitor.reportDatabaseError({
        message: "Request failed with status code 409",
        response: {
          data: {
            error: {
              code: "PERSISTENT_SESSION_MARKER_MISMATCH",
              message: "Remote session marker does not match",
            },
          },
        },
      }),
    ).not.toThrow();
    expect(dbHealthMonitor.isDegraded()).toBe(false);
  });

  it.each([
    null,
    undefined,
    42,
    { message: 42 },
    { response: { data: { error: [] } } },
  ])("tolerates malformed errors: %j", (error) => {
    expect(() => dbHealthMonitor.reportDatabaseError(error)).not.toThrow();
    expect(dbHealthMonitor.isDegraded()).toBe(false);
  });

  it.each([
    {
      response: {
        data: { error: { code: "DATABASE_ERROR", message: "Unavailable" } },
      },
    },
    { response: { data: { error: "sqlite unavailable" } } },
    { code: "ECONNREFUSED", message: "connection refused" },
  ])("continues reporting database and network failures: %j", (error) => {
    dbHealthMonitor.reportDatabaseError(error);
    expect(dbHealthMonitor.isDegraded()).toBe(true);
    dbHealthMonitor.reportDatabaseSuccess();
    expect(dbHealthMonitor.isDegraded()).toBe(false);
  });
});
