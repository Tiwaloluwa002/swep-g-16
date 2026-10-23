import type { DatabaseSync } from "node:sqlite";
import { hashPasswordSync } from "@/lib/server/passwords";
import type { Role } from "@/lib/types";

/** Demo accounts; the passwords are documented in the README. Never use these outside a demo. */
export const DEMO_USERS: { matric: string; name: string; role: Role; password: string; startingNaira: number }[] = [
  { matric: "CSC/2021/001", name: "Adaeze Okafor", role: "student", password: "student123", startingNaira: 2000 },
  { matric: "EEG/2022/014", name: "Tunde Bakare", role: "student", password: "student123", startingNaira: 100 },
  { matric: "CON/001", name: "Musa Ibrahim", role: "conductor", password: "conductor123", startingNaira: 0 },
  { matric: "ADM/001", name: "Transport Admin", role: "admin", password: "admin123", startingNaira: 0 },
];

/** Demo fares in naira. These are made-up values for the demo, not OAU's real fares. */
export const DEMO_ROUTES: { name: string; origin: string; destination: string; fareNaira: number }[] = [
  { name: "Main Gate – SUB", origin: "Main Gate", destination: "Student Union Building (SUB)", fareNaira: 200 },
  { name: "SUB – Faculty of Technology", origin: "Student Union Building (SUB)", destination: "Faculty of Technology", fareNaira: 150 },
  { name: "Moremi Hall – Senate", origin: "Moremi Hall", destination: "Senate Building", fareNaira: 150 },
  { name: "Awolowo Hall – SUB", origin: "Awolowo Hall", destination: "Student Union Building (SUB)", fareNaira: 150 },
  { name: "Fajuyi Hall – Faculty of Technology", origin: "Fajuyi Hall", destination: "Faculty of Technology", fareNaira: 150 },
  { name: "ETF Hall – Senate", origin: "ETF Hall", destination: "Senate Building", fareNaira: 200 },
  { name: "Angola Hall – Health Centre", origin: "Angola Hall", destination: "Health Centre", fareNaira: 150 },
  { name: "Mozambique Hall – Main Gate", origin: "Mozambique Hall", destination: "Main Gate", fareNaira: 250 },
];

/** Vehicle name and the index of its route in DEMO_ROUTES (null = may carry any route). */
const DEMO_VEHICLES: [string, number | null][] = [
  ["Bus 1", 0],
  ["Bus 2", 1],
  ["Bus 3", 0],
  ["Bus 4", 2],
  ["Shuttle 5", null],
];

/** Seeds only an empty database, so restarting never duplicates or resets data. */
export function seedDemoData(db: DatabaseSync, now = Date.now()): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n > 0) return;

  db.exec("BEGIN IMMEDIATE");
  try {
    const insertUser = db.prepare(
      "INSERT INTO users (matric, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const credit = db.prepare(
      "INSERT INTO ledger (user_id, kind, amount_kobo, note, created_at) VALUES (?, 'topup', ?, 'Demo starting balance', ?)",
    );
    for (const u of DEMO_USERS) {
      const { lastInsertRowid } = insertUser.run(u.matric, u.name, u.role, hashPasswordSync(u.password), now);
      if (u.startingNaira > 0) credit.run(lastInsertRowid, u.startingNaira * 100, now);
    }

    const insertRoute = db.prepare(
      "INSERT INTO routes (name, origin, destination, fare_kobo, active, updated_at) VALUES (?, ?, ?, ?, 1, ?)",
    );
    const routeIds = DEMO_ROUTES.map(
      (r) => insertRoute.run(r.name, r.origin, r.destination, r.fareNaira * 100, now).lastInsertRowid,
    );
    const insertVehicle = db.prepare("INSERT INTO vehicles (name, route_id) VALUES (?, ?)");
    for (const [name, routeIndex] of DEMO_VEHICLES) {
      insertVehicle.run(name, routeIndex === null ? null : routeIds[routeIndex]);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
