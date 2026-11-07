import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { CardInput } from "./catalog.js";

export type Card = CardInput & { id: string };
export class CardRepository {
  constructor(
    private db: any,
    private table: any,
    private persist: () => Promise<void>,
  ) {}
  async list(): Promise<Card[]> {
    return this.db
      .select()
      .from(this.table)
      .orderBy(asc(this.table.order), asc(this.table.name));
  }
  private async find(id: string): Promise<Card | null> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  async create(card: CardInput): Promise<Card> {
    const row = { ...card, id: randomUUID() };
    await this.db.insert(this.table).values(row);
    await this.persist();
    return row;
  }
  async update(id: string, card: CardInput): Promise<Card | null> {
    if (!(await this.find(id))) return null;
    await this.db.update(this.table).set(card).where(eq(this.table.id, id));
    await this.persist();
    return this.find(id);
  }
  async remove(id: string): Promise<boolean> {
    if (!(await this.find(id))) return false;
    await this.db.delete(this.table).where(eq(this.table.id, id));
    await this.persist();
    return true;
  }
}
