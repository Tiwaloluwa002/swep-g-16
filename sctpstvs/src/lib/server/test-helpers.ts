import { type Db, openDatabase } from "@/lib/server/db";
import { generateSigningKeys } from "@/lib/server/keys";

export function testDb(): Db {
  return openDatabase(":memory:");
}

export const testKeys = generateSigningKeys();

export function userId(db: Db, matric: string): number {
  return (db.prepare("SELECT id FROM users WHERE matric = ?").get(matric) as { id: number }).id;
}

export function routeId(db: Db, name: string): number {
  return (db.prepare("SELECT id FROM routes WHERE name = ?").get(name) as { id: number }).id;
}

export const RICH = "CSC/2021/001"; // ₦2,000 seeded
export const POOR = "EEG/2022/014"; // ₦100 seeded, below every demo fare
export const CONDUCTOR = "CON/001";
