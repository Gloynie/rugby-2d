import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The database is OPTIONAL. Quick matches work without one ("guest mode");
 * accounts, saved results and competitions need PostgreSQL – see README.md.
 */
export const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __rugbyDbWarned?: boolean;
};

if (!process.env.DATABASE_URL && !globalForDb.__rugbyDbWarned) {
  globalForDb.__rugbyDbWarned = true;
  console.warn(
    `[rugby2d] DATABASE_URL is not set – trying ${DEFAULT_DATABASE_URL}. ` +
      "Quick matches work without a database; accounts & competitions need PostgreSQL (see README.md).",
  );
}

function createPool(): Pool {
  const p = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  // Never let an idle-client error crash the server (e.g. Postgres restarted).
  p.on("error", (err) => console.error("[rugby2d] PostgreSQL pool error:", err.message));
  return p;
}

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
