import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Lazily initialise so that importing this module (e.g. during `next build`
// route collection) never fails when DATABASE_URL is absent. The connection is
// only created the first time a query is actually issued at request time.
let instance: Db | null = null;

function getDb(): Db {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not defined. Add it to .env.local (use the Supabase pooled connection string)."
    );
  }

  const client = postgres(connectionString, {
    prepare: false,
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });

  instance = drizzle(client, { schema });
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
