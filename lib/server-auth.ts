import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'fb_odonto_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias
export const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

// Segredo de assinatura de sessão: usa AUTH_SECRET do ambiente ou gera chave em memória para o processo
const globalForAuth = globalThis as typeof globalThis & {
  __fbOdontoAuthSecret?: Buffer;
  __fbOdontoRevokedHashes?: Set<string>;
};
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

function getRevokedHashesSet(): Set<string> {
  if (!globalForAuth.__fbOdontoRevokedHashes) {
    globalForAuth.__fbOdontoRevokedHashes = new Set<string>();
  }
  return globalForAuth.__fbOdontoRevokedHashes;
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

type StoredSessionRecord = {
  tokenHash: string;
  usuario: string;
  nome: string;
  role: 'admin' | 'operador';
  exp: number;
};

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readLocalSessions(): StoredSessionRecord[] {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return [];
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return (parsed as StoredSessionRecord[]).filter(
      (s) => s && typeof s.tokenHash === 'string' && typeof s.exp === 'number' && s.exp > now
    );
  } catch {
    return [];
  }
}

function writeLocalSessions(sessions: StoredSessionRecord[]): void {
  try {
    ensureDataDir();
    const now = Date.now();
    const valid = sessions.filter((s) => s.exp > now).slice(-100);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(valid, null, 2), { mode: 0o600 });
  } catch {
    // ignora falha de escrita em ambiente somente leitura
  }
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export async function saveSessionRecord(
  token: string,
  payload: Omit<SessionPayload, 'exp'>
): Promise<void> {
  const tokenHash = hashSessionToken(token);
  const exp = Date.now() + SESSION_TTL_MS;
  getRevokedHashesSet().delete(tokenHash);

  const localSessions = readLocalSessions().filter((s) => s.tokenHash !== tokenHash);
  localSessions.push({
    tokenHash,
    usuario: payload.usuario,
    nome: payload.nome,
    role: payload.role,
    exp,
  });
  writeLocalSessions(localSessions);

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('sessoes').upsert(
        [
          {
            token_hash: tokenHash,
            usuario: payload.usuario,
            nome: payload.nome,
            role: payload.role,
            expira_em: new Date(exp).toISOString(),
          },
        ],
        { onConflict: 'token_hash' }
      );
      if (error && !isMissingTableError(error)) {
        console.warn('Erro ao salvar sessão no Supabase:', error.message);
      }
    } catch {
      // fallback já salvo localmente
    }
  }
}

export async function touchSessionRecord(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  const novoExp = Date.now() + SESSION_TTL_MS;

  const localSessions = readLocalSessions();
  const idx = localSessions.findIndex((s) => s.tokenHash === tokenHash);
  if (idx >= 0) {
    localSessions[idx] = { ...localSessions[idx], exp: novoExp };
    writeLocalSessions(localSessions);
  }

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from('sessoes')
        .update({ expira_em: new Date(novoExp).toISOString() })
        .eq('token_hash', tokenHash);
      if (error && !isMissingTableError(error)) {
        console.warn('Erro ao renovar sessão no Supabase:', error.message);
      }
    } catch {
      // ignora erro de rede
    }
  }
}

export async function revokeSessionRecord(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  getRevokedHashesSet().add(tokenHash);

  const localSessions = readLocalSessions().filter((s) => s.tokenHash !== tokenHash);
  writeLocalSessions(localSessions);

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('sessoes').delete().eq('token_hash', tokenHash);
      if (error && !isMissingTableError(error)) {
        console.warn('Erro ao revogar sessão no Supabase:', error.message);
      }
    } catch {
      // ignora erro de rede
    }
  }
}

async function findPersistedSession(token: string): Promise<SessionPayload | null> {
  const tokenHash = hashSessionToken(token);
  if (getRevokedHashesSet().has(tokenHash)) return null;

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('sessoes')
        .select('usuario, nome, role, expira_em')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!error && data) {
        const expMs = new Date(data.expira_em as string).getTime();
        if (Number.isFinite(expMs) && expMs > Date.now()) {
          return {
            usuario: data.usuario as string,
            nome: data.nome as string,
            role: data.role === 'admin' ? 'admin' : 'operador',
            exp: expMs,
          };
        }
        return null;
      }
    } catch {
      // tenta store local abaixo
    }
  }

  const localSessions = readLocalSessions();
  const encontrado = localSessions.find((s) => s.tokenHash === tokenHash);
  if (!encontrado || encontrado.exp <= Date.now()) return null;

  return {
    usuario: encontrado.usuario,
    nome: encontrado.nome,
    role: encontrado.role,
    exp: encontrado.exp,
  };
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  if (getRevokedHashesSet().has(hashSessionToken(token))) return null;

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

export function extractTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) return bearerToken;
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return cookieToken || null;
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = extractTokenFromRequest(req);
  return verifySessionToken(token);
}

export async function resolveSessionFromRequest(
  req: NextRequest
): Promise<{ session: SessionPayload; token: string } | null> {
  const authHeader = req.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value || null;

  const candidatos = [bearerToken, cookieToken].filter(
    (t): t is string => Boolean(t)
  );

  for (const token of candidatos) {
    const tokenHash = hashSessionToken(token);
    if (getRevokedHashesSet().has(tokenHash)) continue;

    const stored = await findPersistedSession(token);
    if (stored) {
      return { session: stored, token };
    }

    const signed = verifySessionToken(token);
    if (signed) {
      return { session: signed, token };
    }
  }

  return null;
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
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
}

export function clearSessionCookie(res: NextResponse) {
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}
