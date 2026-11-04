import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export interface PersistentEmployee {
  allowlistId: string;
  employeeName: string;
  authorizedEmail: string;
  isClaimed: boolean;
  isActive: boolean;
  claimedBy?: string;
  createdAt: string;
  updatedAt: string;
  profile?: {
    id: string;
    username: string;
    email: string;
    employeeName: string;
    role: 'ADMIN' | 'SYSTEM_OWNER';
    status: string;
    passwordHash: string;
    salt: string;
    createdAt: string;
    updatedAt: string;
  };
  permissions?: {
    product_manage: boolean;
    price_edit: boolean;
    price_bulk_import: boolean;
    share_link_manage: boolean;
    reports_view: boolean;
  };
}

const STORE_FILENAME = 'employees_persistent.json';

function getLocalStorePath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    return path.join(dataDir, STORE_FILENAME);
  }
  if (process.platform === 'linux' && fs.existsSync('/tmp')) {
    return path.join('/tmp', STORE_FILENAME);
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, STORE_FILENAME);
  } catch {
    return path.join(process.cwd(), STORE_FILENAME);
  }
}

let inMemoryStore: PersistentEmployee[] | null = null;

async function getNetlifyStore() {
  try {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const { getStore } = await import('@netlify/blobs');
      return getStore('thaiudon-employees');
    }
  } catch {
    // Netlify blobs not available or local environment
  }
  return null;
}

export async function loadPersistentEmployees(): Promise<PersistentEmployee[]> {
  if (inMemoryStore && inMemoryStore.length > 0) {
    return inMemoryStore;
  }

  // 1. Try Netlify Blobs if in serverless
  try {
    const netlifyStore = await getNetlifyStore();
    if (netlifyStore) {
      const blobData = await netlifyStore.get('employees_list', { type: 'json' });
      if (Array.isArray(blobData) && blobData.length > 0) {
        inMemoryStore = blobData as PersistentEmployee[];
        try {
          fs.writeFileSync(getLocalStorePath(), JSON.stringify(inMemoryStore, null, 2), 'utf-8');
        } catch {}
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.warn('[employee-store] Netlify blob read warning:', err);
  }

  // 2. Read from local file
  const localPath = getLocalStorePath();
  try {
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryStore = parsed;
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.warn('[employee-store] Local read error:', err);
  }

  // 3. Fallback: seed default
  inMemoryStore = [
    {
      allowlistId: 'emp_david_001',
      employeeName: 'ดาวิด สุขสมบริบูรณ์',
      authorizedEmail: 'davidsuksomboriboon@gmail.com',
      isClaimed: true,
      isActive: true,
      claimedBy: 'usr_owner_david_001',
      createdAt: '2026-10-30 03:11:10',
      updatedAt: '2026-10-30 03:11:10',
      profile: {
        id: 'usr_owner_david_001',
        username: 'davidsuksomboriboon',
        email: 'davidsuksomboriboon@gmail.com',
        employeeName: 'ดาวิด สุขสมบริบูรณ์',
        role: 'SYSTEM_OWNER',
        status: 'Active',
        passwordHash: '8cb3d6232ee5db0160a28fba100c8f5d0f622f6463945c26b5e523f269a84d413340f6b3b5fc91adbf3d132adcd7e0a4ad687ef0f66a2f4ddb92b6be008c2c1a',
        salt: '942fa753b89b4f9dfc757474a5840d42',
        createdAt: '2026-10-30 03:11:10',
        updatedAt: '2026-10-30 03:11:10',
      },
      permissions: {
        product_manage: true,
        price_edit: true,
        price_bulk_import: true,
        share_link_manage: true,
        reports_view: true,
      },
    },
  ];

  await savePersistentEmployees(inMemoryStore);
  return inMemoryStore;
}

export async function savePersistentEmployees(employees: PersistentEmployee[]): Promise<void> {
  inMemoryStore = employees;

  try {
    const localPath = getLocalStorePath();
    fs.writeFileSync(localPath, JSON.stringify(employees, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[employee-store] Failed to write local JSON:', err);
  }

  try {
    const netlifyStore = await getNetlifyStore();
    if (netlifyStore) {
      await netlifyStore.setJSON('employees_list', employees);
    }
  } catch (err) {
    console.warn('[employee-store] Netlify blob write warning:', err);
  }
}

/**
 * Ensures all persistent employees exist inside the SQLite database instance.
 */
export async function syncEmployeesToDb(db: DatabaseSync): Promise<void> {
  try {
    // First, sync any existing SQLite records into persistent store if missing
    await syncFromDbToPersistent(db);

    const employees = await loadPersistentEmployees();

    for (const emp of employees) {
      // 1. Sync Profile if exists
      if (emp.profile) {
        const existingProfile = db.prepare('SELECT id FROM profiles WHERE id = ? OR username = ?').get(emp.profile.id, emp.profile.username);
        if (!existingProfile) {
          db.prepare(`
            INSERT OR REPLACE INTO profiles (id, username, email, employee_name, role, status, password_hash, salt, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(
            emp.profile.id,
            emp.profile.username,
            emp.profile.email,
            emp.profile.employeeName,
            emp.profile.role,
            emp.profile.status || 'Active',
            emp.profile.passwordHash,
            emp.profile.salt,
            emp.profile.createdAt || emp.createdAt,
            emp.profile.updatedAt || emp.updatedAt
          );
        }

        // 2. Sync Permissions
        if (emp.permissions) {
          const permId = 'perm_' + emp.profile.id.replace('usr_', '');
          db.prepare(`
            INSERT OR REPLACE INTO admin_permissions (id, profile_id, product_manage, price_edit, price_bulk_import, share_link_manage, reports_view, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            permId,
            emp.profile.id,
            emp.permissions.product_manage ? 1 : 0,
            emp.permissions.price_edit ? 1 : 0,
            emp.permissions.price_bulk_import ? 1 : 0,
            emp.permissions.share_link_manage ? 1 : 0,
            emp.permissions.reports_view ? 1 : 0
          );
        }
      }

      // 3. Sync employee_allowlist
      db.prepare(`
        INSERT OR REPLACE INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, claimed_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        emp.allowlistId,
        emp.employeeName,
        emp.authorizedEmail,
        emp.isClaimed ? 1 : 0,
        emp.isActive ? 1 : 0,
        emp.claimedBy || null,
        emp.createdAt,
        emp.updatedAt
      );
    }
  } catch (err) {
    console.error('[employee-store] syncEmployeesToDb error:', err);
  }
}

/**
 * Bi-directional sync: If SQLite contains employees not yet in JSON, absorb them into persistent store.
 */
export async function syncFromDbToPersistent(db: DatabaseSync): Promise<void> {
  try {
    const localPath = getLocalStorePath();
    let list: PersistentEmployee[] = [];
    if (fs.existsSync(localPath)) {
      try {
        list = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      } catch {}
    }

    const rows = db.prepare(`
      SELECT 
        e.id as allowlistId,
        e.employee_name as employeeName,
        e.authorized_email as authorizedEmail,
        e.is_claimed as isClaimed,
        e.is_active as isActive,
        e.claimed_by as claimedBy,
        e.created_at as createdAt,
        e.updated_at as updatedAt,
        p.id as profileId,
        p.username,
        p.email,
        p.role,
        p.status,
        p.password_hash as passwordHash,
        p.salt,
        perm.product_manage,
        perm.price_edit,
        perm.price_bulk_import,
        perm.share_link_manage,
        perm.reports_view
      FROM employee_allowlist e
      LEFT JOIN profiles p ON e.claimed_by = p.id
      LEFT JOIN admin_permissions perm ON p.id = perm.profile_id
    `).all() as any[];

    let changed = false;
    for (const r of rows) {
      const idx = list.findIndex(e => e.allowlistId === r.allowlistId || e.employeeName === r.employeeName);
      const item: PersistentEmployee = {
        allowlistId: r.allowlistId,
        employeeName: r.employeeName,
        authorizedEmail: r.authorizedEmail,
        isClaimed: Boolean(r.isClaimed),
        isActive: Boolean(r.isActive),
        claimedBy: r.claimedBy || undefined,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString(),
        ...(r.profileId ? {
          profile: {
            id: r.profileId,
            username: r.username,
            email: r.email,
            employeeName: r.employeeName,
            role: r.role,
            status: r.status,
            passwordHash: r.passwordHash,
            salt: r.salt,
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || new Date().toISOString(),
          },
          permissions: {
            product_manage: Boolean(r.product_manage),
            price_edit: Boolean(r.price_edit),
            price_bulk_import: Boolean(r.price_bulk_import),
            share_link_manage: Boolean(r.share_link_manage),
            reports_view: Boolean(r.reports_view),
          }
        } : {})
      };

      if (idx >= 0) {
        if (!list[idx].profile && item.profile) {
          list[idx] = item;
          changed = true;
        }
      } else {
        list.push(item);
        changed = true;
      }
    }

    if (changed) {
      inMemoryStore = list;
      fs.writeFileSync(localPath, JSON.stringify(list, null, 2), 'utf-8');
      const netlifyStore = await getNetlifyStore();
      if (netlifyStore) {
        await netlifyStore.setJSON('employees_list', list);
      }
    }
  } catch (err) {
    console.warn('[employee-store] syncFromDbToPersistent error:', err);
  }
}
