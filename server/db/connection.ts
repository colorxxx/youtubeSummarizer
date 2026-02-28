import { drizzle } from "drizzle-orm/mysql2";
import { createLogger } from '../_core/logger';

const log = createLogger("Database");

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      log.warn("Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
