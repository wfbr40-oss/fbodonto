import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'fb_odonto_session';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

// Segredo de assinatura de sessão: usa AUTH_SECRET do ambiente ou gera chave em memória para o processo
const globalForAuth = globalThis as typeof globalThis & { __fbOdontoAuthSecret?: Buffer };
function getSigningKey(): Buffer {
  const envSecret = process.env.AUTH_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  if (!globalForAuth.__fbOdontoAuthSecret) {
    globalForAuth.__fbOdontoAuthSecret = crypto.randomBytes(32);
  }
  return globalForAuth.__fbOdontoAuthSecret;
}

export type StoredUser = {
  usuario: string;
  nome: string;
  role: 'admin' | 'operador';
  salt: string;
  hash: string;
  criadoEm: string;
};

export type PublicUser = {
  usuario: string;
  nome: string;
  role: 'admin' | 'operador';
  criadoEm: string;
};

export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase().replace(/\s+/g, '');
}

export function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function timingSafeEqualStr(aStr: string, bStr: string): boolean {
  const a = crypto.createHash('sha256').update(aStr).digest();
  const b = crypto.createHash('sha256').update(bStr).digest();
  return crypto.timingSafeEqual(a, b);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readStoredUsers(): StoredUser[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredUsers(users: StoredUser[]): void {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
}

export function getEnvAdminConfig(): { username: string; password: string } | null {
  const pwd = process.env.ADMIN_PASSWORD?.trim();
  if (!pwd) return null;
  const username = normalizarUsuario(process.env.ADMIN_USERNAME || 'admin') || 'admin';
  return { username, password: pwd };
}

export function isAdminConfigured(): boolean {
  if (getEnvAdminConfig()) return true;
  const users = readStoredUsers();
  return users.some((u) => u.role === 'admin' || u.usuario === 'admin');
}

export type SessionPayload = {
  usuario: string;
  nome: string;
  role: 'admin' | 'operador';
  exp: number;
};

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 dias
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.usuario || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const verified = verifySessionToken(bearerToken);
    if (verified) return verified;
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(cookieToken);
}

export function verifySameOriginMutation(req: NextRequest): boolean {
  const requestedWith = req.headers.get('x-requested-with');
  if (requestedWith === 'XMLHttpRequest') return true;

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export function attachSessionCookie(res: NextResponse, token: string) {
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${60 * 60 * 24 * 7}`
  );
}

export function clearSessionCookie(res: NextResponse) {
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}
