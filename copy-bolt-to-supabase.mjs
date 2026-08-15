import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const SOURCE_URL = process.env.SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.SOURCE_SUPABASE_ANON_KEY;

const TARGET_URL = process.env.TARGET_SUPABASE_URL;
const TARGET_SERVICE_ROLE_KEY = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL || !TARGET_SERVICE_ROLE_KEY) {
  console.error(`
Missing credentials.

Create .env.local with:

SOURCE_SUPABASE_URL=https://zycpcnyvmizockvgeehd.supabase.co
SOURCE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5Y3Bjbnl2bWl6b2NrdmdlZWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDU0NTQsImV4cCI6MjEwMTE4MTQ1NH0.IinBKxFUPwUI0u8a7ZAx6CXntAz4GVO2zviSr5cnYtA
TARGET_SUPABASE_URL=https://gjbajcloegqjcykfafnr.supabase.co
TARGET_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqYmFqY2xvZWdxamN5a2ZhZm5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjczMjQ5OCwiZXhwIjoyMTAyMzA4NDk4fQ.sI-Dm1ONmrdnZp-t9K7NN1o6-YFykw70DhOB3VSbkHE`);
  process.exit(1);
}

const source = createClient(SOURCE_URL, SOURCE_KEY, {
  auth: { persistSession: false },
});

const target = createClient(TARGET_URL, TARGET_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tables = [
  "clubs",
  "participants",
  "events",
  "registrations",
  "heats",
  "heat_entries",
  "race_state",
  "settings",
];

const PAGE_SIZE = 500;

async function readAll(table) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await source
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`SOURCE READ FAILED [${table}]: ${error.message}`);
    }

    if (data?.length) {
      rows.push(...data);
    }

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function copyTable(table) {
  const rows = await readAll(table);

  console.log(`${table}: ${rows.length} source rows`);

  if (!rows.length) {
    return;
  }

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);

    const { error } = await target
      .from(table)
      .upsert(batch, { defaultToNull: false });

    if (error) {
      throw new Error(
        `TARGET INSERT FAILED [${table}]: ${error.message}`
      );
    }

    console.log(
      `  copied ${Math.min(i + 100, rows.length)}/${rows.length}`
    );
  }
}

async function main() {
  console.log("\nStarting Bolt → Supabase copy...\n");

  for (const table of tables) {
    await copyTable(table);
  }

  console.log("\n================================");
  console.log("COPY COMPLETED SUCCESSFULLY");
  console.log("================================\n");
}

main().catch((error) => {
  console.error("\nCOPY FAILED:");
  console.error(error.message);
  process.exit(1);
});