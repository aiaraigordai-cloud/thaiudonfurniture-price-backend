import crypto from 'node:crypto';
import { getDb } from './db';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'catalog_a_session';
const SECRET_KEY = process.env.APP_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-secret');
if (!SECRET_KEY) throw new Error('APP_SECRET is required in production');

export interface UserSession {
  id: string;
  username: string;
  email: string;
  employee_name: string;
  role: 'SYSTEM_OWNER' | 'ADMIN';
  status: string;
  permissions?: {
    product_manage: boolean;
    price_edit: boolean;
    price_bulk_import: boolean;
    share_link_manage: boolean;
    reports_view: boolean;
  };
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

export function createSessionToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): any | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload || !payload.id) return null;

  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, email, employee_name, role, status, email_verified
    FROM profiles
    WHERE id = ?
  `).get(payload.id) as any;

  if (!user || user.status !== 'Active') {
    return null;
  }

  // If Admin, fetch permissions
  let permissions = {
    product_manage: true,
    price_edit: true,
    price_bulk_import: true,
    share_link_manage: true,
    reports_view: true,
  };

  if (user.role === 'ADMIN') {
    const perm = db.prepare(`
      SELECT product_manage, price_edit, price_bulk_import, share_link_manage, reports_view
      FROM admin_permissions
      WHERE profile_id = ?
    `).get(user.id) as any;

    if (perm) {
      permissions = {
        product_manage: Boolean(perm.product_manage),
        price_edit: Boolean(perm.price_edit),
        price_bulk_import: Boolean(perm.price_bulk_import),
        share_link_manage: Boolean(perm.share_link_manage),
        reports_view: Boolean(perm.reports_view),
      };
    } else {
      permissions = {
        product_manage: false,
        price_edit: false,
        price_bulk_import: false,
        share_link_manage: false,
        reports_view: false,
      };
    }
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    employee_name: user.employee_name,
    role: user.role,
    status: user.status,
    permissions,
  };
}

export function logAudit(action: string, entityType: string, entityId: string | null, actorId: string | null, actorUsername: string | null, details: object | string) {
  try {
    const db = getDb();
    const id = crypto.randomUUID();
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    db.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_id, actor_username, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, action, entityType, entityId, actorId, actorUsername, detailsStr);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
