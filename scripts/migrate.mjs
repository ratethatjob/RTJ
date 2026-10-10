// Applies supabase/migrations/*.sql to the database Vercel's Supabase
// integration provides, before `next build`. Applied versions are tracked in
// supabase_migrations.schema_migrations, the same table the Supabase CLI uses.
// Skips silently when no database URL is configured (local builds).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.rtj_POSTGRES_URL_NON_POOLING ??
  process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.log("migrate: no database URL, skipping");
  process.exit(0);
}

// The pooler's certificate isn't in Node's CA store; sslmode in the URL would
// force verification, so drop it and enable TLS explicitly.
const connectionString = url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
const client = new pg.Client({
  connectionString,
  ssl: local ? false : { rejectUnauthorized: false },
});

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

await client.connect();
try {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );`);
  const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  for (const file of files) {
    const [version, ...rest] = path.basename(file, ".sql").split("_");
    if (applied.has(version)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    console.log(`migrate: applying ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
        [version, rest.join("_"), [sql]],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  // Make PostgREST pick up new tables and views right away.
  await client.query("notify pgrst, 'reload schema'");
  console.log("migrate: up to date");
} finally {
  await client.end();
}
