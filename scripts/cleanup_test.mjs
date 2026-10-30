import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const user = db.prepare("SELECT id FROM profiles WHERE username LIKE 'nitipon_%'").get();
if (user) {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.prepare('DELETE FROM admin_permissions WHERE profile_id = ?').run(user.id);
  db.prepare("DELETE FROM employee_allowlist WHERE employee_name = 'นิติพล รักษาการ'").run();
  db.prepare('DELETE FROM profiles WHERE id = ?').run(user.id);
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('Cleaned test user.');
}

db.exec('DELETE FROM share_events;');
console.log('Share events reset to 0:', db.prepare('SELECT count(*) as c FROM share_events').get().c);
