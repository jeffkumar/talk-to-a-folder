import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
  path: ".env.local",
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "migrations");

const runMigrate = async () => {
  const useLocalDb = process.env.USE_LOCAL_DB === "true";
  const localPostgresUrl =
    process.env.LOCAL_POSTGRES_URL ?? "postgresql://localhost:5432/flowchat";
  const postgresUrl = useLocalDb ? localPostgresUrl : process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error(
      "POSTGRES_URL is not defined. In production, set it in your host's environment (e.g. Vercel → Project → Environment Variables)."
    );
  }

  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
