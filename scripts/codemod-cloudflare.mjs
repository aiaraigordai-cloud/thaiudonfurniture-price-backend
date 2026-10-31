import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.ts')) {
      const before = fs.readFileSync(file, 'utf8');
      const after = before
        .replace(/(?<!await )\bdb\.prepare\(/g, 'await db.prepare(')
        .replace(/(?<!await )\bdb\.exec\(/g, 'await db.exec(')
        .replace(/(?<!await )\blogAudit\(/g, 'await logAudit(');
      if (after !== before) fs.writeFileSync(file, after);
    }
  }
}

walk('src/app/api');
const authFile = 'src/lib/auth.ts';
let auth = fs.readFileSync(authFile, 'utf8');
auth = auth.replace('export function logAudit(', 'export async function logAudit(')
  .replace(/(?<!await )\bdb\.prepare\(/g, 'await db.prepare(');
fs.writeFileSync(authFile, auth);
