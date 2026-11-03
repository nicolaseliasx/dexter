import type { RequestHandler, Router } from "express";
import { normalizeUrl, validateCard, type CardInput } from "./catalog.js";

const appHubCards: CardInput[] = [
  {
    name: "Jobhunter",
    url: "http://192.168.15.40/",
    description: "Job search and opportunity automation dashboard.",
    icon: "JH",
    color: "#d7ff3f",
    order: 0,
  },
  {
    name: "Mercado Livre",
    url: "https://mlsantana.ncls.cc/",
    description: "Store sales, ads and operations control.",
    icon: "ML",
    color: "#ffe600",
    order: 1,
  },
  {
    name: "Styllus Gym Finance",
    url: "https://styllusfinance.ncls.cc/",
    description: "Gestão financeira e operacional da academia.",
    icon: "GF",
    color: "#8b7cff",
    order: 2,
  },
  {
    name: "Clipfactory",
    url: "https://clipfactory.ncls.cc/",
    description: "Automatic video and channel metrics pipeline.",
    icon: "CF",
    color: "#ff4d4d",
    order: 3,
  },
  {
    name: "Filmhub",
    url: "https://filmhub.ncls.cc/",
    description: "Private video library for web and TV.",
    icon: "FH",
    color: "#de8a50",
    order: 4,
  },
  {
    name: "Lict Hunter API",
    url: "https://licitacoes.ncls.cc/docs",
    description: "API documentation and endpoints.",
    icon: "API",
    color: "#ff748c",
    order: 5,
  },
];

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
  router.post("/import-app-hub", deps.manage, async (_req, res) => {
    if (!(await deps.isAdmin())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = (await deps.repository.list()) as { url: string }[];
    const existing = new Set(rows.map((row) => normalizeUrl(row.url)));
    let imported = 0;
    for (const card of appHubCards) {
      if (!existing.has(card.url)) {
        await deps.repository.create(card);
        existing.add(card.url);
        imported++;
      }
    }
    res.json({ data: { imported } });
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
