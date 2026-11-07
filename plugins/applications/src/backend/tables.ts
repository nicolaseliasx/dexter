import { defineTable, integer, varchar } from "@termix-ssh/plugin-sdk/db";

export const cards = defineTable("cards", {
  id: varchar(36).primaryKey(),
  name: varchar(100).notNull(),
  url: varchar(2048).notNull(),
  description: varchar(500).notNull(),
  icon: varchar(8).notNull(),
  color: varchar(7).notNull(),
  order: integer().notNull(),
});
export const tables = [cards];
