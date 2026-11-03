import type { Request, RequestHandler, Response, Router } from "express";
import { asPersistentSessionError, PersistentSessionError } from "./errors.js";
import type { PersistentSessionLifecycleService } from "./lifecycle.js";
import type { SessionCreateInput, SessionRepository } from "./repository.js";

export interface RouteDeps {
  lifecycle: PersistentSessionLifecycleService;
  repository: SessionRepository;
  /** Observes the given hosts as the caller; empty list means every host with an active session. */
  reconcile: (userId: string, hostIds?: number[]) => Promise<unknown>;
  /** The signed-in user of the current request. */
  actor: () => string | undefined;
  /** Middleware that enforces the plugin's `use` permission. */
  guard: () => RequestHandler;
  /** Whether the caller may use this host. */
  canAccessHost: (hostId: number) => Promise<boolean>;
}

function fail(res: Response, error: unknown): void {
  const typed = asPersistentSessionError(error);
  res.status(typed.status).json({
    error: {
      code: typed.code,
      message: typed.message,
      ...(typed.details ? { details: typed.details } : {}),
    },
  });
}
function page(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : fallback;
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
}
function param(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

type ImportRow = Partial<SessionCreateInput> & { id?: unknown };
function validImport(row: ImportRow): row is SessionCreateInput {
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    row.id.length <= 36 &&
    Number.isInteger(row.hostId) &&
    typeof row.displayName === "string" &&
    row.displayName.length > 0 &&
    typeof row.tmuxSessionName === "string" &&
    row.tmuxSessionName.length > 0
  );
}

export function registerRoutes(router: Router, deps: RouteDeps): void {
  const userId = (): string => {
    const id = deps.actor();
    if (!id) throw new PersistentSessionError("PERSISTENT_SESSION_NOT_FOUND");
    return id;
  };
  const guard = deps.guard();

  /**
   * @openapi
   * /:
   *   get:
   *     summary: List the signed-in user's persistent sessions
   *     parameters:
   *       - { in: query, name: limit, schema: { type: integer } }
   *       - { in: query, name: offset, schema: { type: integer } }
   *       - { in: query, name: includeEnded, schema: { type: boolean } }
   *     responses:
   *       "200": { description: A page of sessions }
   */
  router.get("/", guard, async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, page(req.query.limit, 50, 100));
      const offset = page(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
      const result = await deps.lifecycle.list(
        userId(),
        limit,
        offset,
        req.query.includeEnded === "true",
      );
      res.json({
        data: result.data,
        meta: { total: result.total, limit, offset },
      });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /:
   *   post:
   *     summary: Create a persistent tmux session on a host
   *     responses:
   *       "201": { description: The new session }
   */
  router.post("/", guard, async (req: Request, res: Response) => {
    try {
      res
        .status(201)
        .json({ data: await deps.lifecycle.create(userId(), req.body ?? {}) });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /import:
   *   post:
   *     summary: Import sessions exported from the old built-in Sessions feature, as the caller
   *     responses:
   *       "200": { description: Counts of imported, skipped and rejected rows }
   */
  router.post("/import", guard, async (req: Request, res: Response) => {
    try {
      const owner = userId();
      const rows: ImportRow[] = Array.isArray(req.body?.sessions)
        ? req.body.sessions
        : [];
      const counts = { imported: 0, skipped: 0, rejected: 0 };
      for (const row of rows.slice(0, 1000)) {
        if (!validImport(row) || !(await deps.canAccessHost(row.hostId))) {
          counts.rejected++;
          continue;
        }
        // Rows always belong to the caller, whatever the file says.
        const outcome = await deps.repository.importRow({
          ...row,
          userId: owner,
        });
        counts[outcome === "imported" ? "imported" : "skipped"]++;
      }
      res.json({ data: counts });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /reconciliations:
   *   post:
   *     summary: Observe tmux on the caller's hosts now
   *     responses:
   *       "200": { description: Per host results }
   */
  router.post(
    "/reconciliations",
    guard,
    async (_req: Request, res: Response) => {
      try {
        res.json({ data: await deps.reconcile(userId()) });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  /**
   * @openapi
   * /adoptions:
   *   post:
   *     summary: Adopt an existing tmux session as a managed one
   *     responses:
   *       "201": { description: The adopted session }
   */
  router.post("/adoptions", guard, async (req: Request, res: Response) => {
    try {
      res
        .status(201)
        .json({ data: await deps.lifecycle.adopt(userId(), req.body ?? {}) });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /{id}:
   *   get:
   *     summary: Read one persistent session
   *     responses:
   *       "200": { description: The session }
   */
  router.get("/:id", guard, async (req: Request, res: Response) => {
    try {
      res.json({
        data: await deps.lifecycle.get(param(req.params.id), userId()),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /{id}/attachment:
   *   get:
   *     summary: Validate the remote marker and resolve an immutable tmux target before attachment
   *     responses:
   *       "200": { description: Current session and validated tmux target }
   */
  router.get("/:id/attachment", guard, async (req: Request, res: Response) => {
    try {
      res.json({
        data: await deps.lifecycle.attachment(param(req.params.id), userId()),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /{id}:
   *   patch:
   *     summary: Rename a persistent session
   *     responses:
   *       "200": { description: The updated session }
   */
  router.patch("/:id", guard, async (req: Request, res: Response) => {
    try {
      res.json({
        data: await deps.lifecycle.patch(
          param(req.params.id),
          userId(),
          req.body ?? {},
        ),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  /**
   * @openapi
   * /{id}:
   *   delete:
   *     summary: Terminate a persistent session; force ends the record when the host is unreachable
   *     parameters:
   *       - { in: query, name: force, schema: { type: boolean } }
   *     responses:
   *       "200": { description: The ended session }
   */
  router.delete("/:id", guard, async (req: Request, res: Response) => {
    try {
      res.json({
        data: await deps.lifecycle.kill(param(req.params.id), userId(), {
          force: req.query.force === "true",
        }),
      });
    } catch (error) {
      fail(res, error);
    }
  });
}
