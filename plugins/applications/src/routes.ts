import type { RequestHandler, Router } from "express";
import { validateCard, type CardInput } from "./catalog.js";

export interface Repository {
  list(): Promise<unknown[]>;
  create(card: CardInput): Promise<unknown>;
  update(id: string, card: CardInput): Promise<unknown | null>;
  remove(id: string): Promise<boolean>;
}

export function registerRoutes(
  router: Router,
  deps: {
    repository: Repository;
    view: RequestHandler;
    manage: RequestHandler;
    isAdmin: () => Promise<boolean>;
    discover?: () => Promise<unknown>;
  },
): void {
  router.get("/", deps.view, async (_req, res) => {
    res.json({ data: await deps.repository.list() });
  });
  router.get("/suggestions", deps.manage, async (_req, res) => {
    if (!(await deps.isAdmin())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    try {
      if (!deps.discover) throw new Error("Unavailable");
      res.json({ data: await deps.discover() });
    } catch {
      res.status(503).json({ error: "Discovery unavailable" });
    }
  });
  router.post("/", deps.manage, async (req, res) => {
    if (!(await deps.isAdmin())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    let card: CardInput;
    try {
      card = validateCard(req.body);
    } catch {
      res.status(400).json({ error: "Invalid card" });
      return;
    }
    res.status(201).json({ data: await deps.repository.create(card) });
  });
  router.put("/:id", deps.manage, async (req, res) => {
    if (!(await deps.isAdmin())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    let card: CardInput;
    try {
      card = validateCard(req.body);
    } catch {
      res.status(400).json({ error: "Invalid card" });
      return;
    }
    const result = await deps.repository.update(String(req.params.id), card);
    if (!result) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: result });
  });
  router.delete("/:id", deps.manage, async (req, res) => {
    if (!(await deps.isAdmin())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!(await deps.repository.remove(String(req.params.id)))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: true });
  });
}
