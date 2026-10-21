import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Running fee_withdrawn migration...");
  await sql`ALTER TABLE markets_cache ADD COLUMN IF NOT EXISTS fee_withdrawn BOOLEAN NOT NULL DEFAULT FALSE`;
  console.log("✓ fee_withdrawn column added to markets_cache");
}

migrate().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
