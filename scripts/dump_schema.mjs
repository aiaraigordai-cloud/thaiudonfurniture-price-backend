import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/catalog_a.sqlite');
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for (const t of tables) {
  console.log(`=== TABLE: ${t.name} ===`);
  console.log(t.sql);
  console.log();
}
