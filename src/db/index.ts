import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __sqlite?: Database.Database };

function open() {
  const sqlite = new Database(path.join(DATA_DIR, "lliga.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const d = drizzle(sqlite, { schema });
  migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return sqlite;
}

const sqlite = globalForDb.__sqlite ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
