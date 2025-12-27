import { pool } from "./connection";
import fs from "fs";
import path from "path";

async function migrate() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    console.log("Running migrations...");

    for (const file of files) {
      if (file.endsWith(".sql")) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
      }
    }

    console.log("Migrations completed.");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
