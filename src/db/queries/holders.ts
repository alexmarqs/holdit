import type { Holder } from "@holdit/core";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { toHolder } from "../rows";
import { holders } from "../schema";

export async function getHolderById(db: Database, id: string): Promise<Holder | null> {
  const rows = await db.select().from(holders).where(eq(holders.id, id)).limit(1);
  return rows[0] ? toHolder(rows[0]) : null;
}

export async function getHolderByHandle(db: Database, handle: string): Promise<Holder | null> {
  const rows = await db.select().from(holders).where(eq(holders.handle, handle)).limit(1);
  return rows[0] ? toHolder(rows[0]) : null;
}
