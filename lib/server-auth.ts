import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
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

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  const configured =
    Boolean(url) &&
    url !== 'https://placeholder.supabase.co' &&
    !url.includes('placeholder') &&
    Boolean(key) &&
    key !== 'placeholder-key';

  if (!configured) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
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

export type UserStorageMode = 'supabase' | 'local';

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

function readLocalUsers(): StoredUser[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: StoredUser[]): void {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
}

type DbUserRow = {
  usuario: string;
  nome: string;
  role: 'admin' | 'operador';
  salt: string;
  hash: string;
  criado_em: string;
};

function mapRowToStoredUser(row: DbUserRow): StoredUser {
  return {
    usuario: row.usuario,
    nome: row.nome,
    role: row.role === 'admin' ? 'admin' : 'operador',
    salt: row.salt,
    hash: row.hash,
    criadoEm: row.criado_em,
  };
}

export async function listStoredUsers(): Promise<{ users: StoredUser[]; storageMode: UserStorageMode }> {
  const sb = getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('usuarios')
        .select('usuario, nome, role, salt, hash, criado_em')
        .order('criado_em', { ascending: true });

      if (!error && data) {
        return {
          users: (data as DbUserRow[]).map(mapRowToStoredUser),
          storageMode: 'supabase',
        };
      }

      if (!isMissingTableError(error)) {
        console.warn('Erro ao consultar public.usuarios no Supabase:', error?.message);
      }
    } catch (e) {
      console.warn('Falha ao conectar no Supabase para usuarios:', e);
    }
  }

  return { users: readLocalUsers(), storageMode: 'local' };
}

export async function findStoredUser(
  usuario: string
): Promise<{ user: StoredUser | null; storageMode: UserStorageMode }> {
  const sb = getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('usuarios')
        .select('usuario, nome, role, salt, hash, criado_em')
        .eq('usuario', usuario)
        .maybeSingle();

      if (!error) {
        return {
          user: data ? mapRowToStoredUser(data as DbUserRow) : null,
          storageMode: 'supabase',
        };
      }

      if (!isMissingTableError(error)) {
        console.warn('Erro ao buscar usuário no Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Falha ao buscar usuário no Supabase:', e);
    }
  }

  const localUsers = readLocalUsers();
  return {
    user: localUsers.find((u) => u.usuario === usuario) || null,
    storageMode: 'local',
  };
}

export async function createStoredUser(
  user: Omit<StoredUser, 'criadoEm'>
): Promise<{ created: StoredUser; storageMode: UserStorageMode }> {
  const criadoEm = new Date().toISOString();
  const sb = getServerSupabase();

  if (sb) {
    try {
      const { data, error } = await sb
        .from('usuarios')
        .insert([
          {
            usuario: user.usuario,
            nome: user.nome,
            role: user.role,
            salt: user.salt,
            hash: user.hash,
            criado_em: criadoEm,
          },
        ])
        .select('usuario, nome, role, salt, hash, criado_em')
        .single();

      if (!error && data) {
        return {
          created: mapRowToStoredUser(data as DbUserRow),
          storageMode: 'supabase',
        };
      }

      if (error?.code === '23505') {
        throw new Error('DUPLICATE_USER');
      }

      if (!isMissingTableError(error)) {
        throw new Error(error?.message || 'Erro ao gravar usuário no Supabase.');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_USER') {
        throw err;
      }
      if (err instanceof Error && !err.message.toLowerCase().includes('does not exist')) {
        throw err;
      }
    }
  }

  const localUsers = readLocalUsers();
  if (localUsers.some((u) => u.usuario === user.usuario)) {
    throw new Error('DUPLICATE_USER');
  }
  const novo: StoredUser = { ...user, criadoEm };
  localUsers.push(novo);
  writeLocalUsers(localUsers);
  return { created: novo, storageMode: 'local' };
}

export function getEnvAdminConfig(): { username: string; password: string } | null {
  const pwd = process.env.ADMIN_PASSWORD?.trim();
  if (!pwd) return null;
  const username = normalizarUsuario(process.env.ADMIN_USERNAME || 'admin') || 'admin';
  return { username, password: pwd };
}

export async function isAdminConfigured(): Promise<{ configured: boolean; storageMode: UserStorageMode }> {
  const { users, storageMode } = await listStoredUsers();
  if (getEnvAdminConfig()) {
    return { configured: true, storageMode };
  }
  return {
    configured: users.some((u) => u.role === 'admin' || u.usuario === 'admin'),
    storageMode,
  };
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
