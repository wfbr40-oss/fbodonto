import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'fb_odonto_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias
export const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

export type CargoUsuario = 'administrador' | 'usuario' | 'cliente';

export function normalizarCargo(role?: string | null): CargoUsuario {
  const limpo = (role || '').trim().toLowerCase();
  if (limpo === 'admin' || limpo === 'administrador') return 'administrador';
  if (limpo === 'cliente') return 'cliente';
  return 'usuario';
}

function cargoParaDbFallback(cargo: CargoUsuario): string {
  if (cargo === 'administrador') return 'admin';
  if (cargo === 'usuario') return 'operador';
  return 'cliente';
}

const DISABLED_MARKER = 'DISABLED';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

const globalForAuth = globalThis as typeof globalThis & {
  __fbOdontoAuthSecret?: Buffer;
  __fbOdontoRevokedHashes?: Set<string>;
  __fbOdontoRevokedUsersAt?: Map<string, number>;
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

function getRevokedUsersMap(): Map<string, number> {
  if (!globalForAuth.__fbOdontoRevokedUsersAt) {
    globalForAuth.__fbOdontoRevokedUsersAt = new Map<string, number>();
  }
  return globalForAuth.__fbOdontoRevokedUsersAt;
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
  role: CargoUsuario;
  salt: string;
  hash: string;
  criadoEm: string;
};

export type PublicUser = {
  usuario: string;
  nome: string;
  role: CargoUsuario;
  criadoEm: string;
  protegido?: boolean;
};

export type UserStorageMode = 'supabase' | 'local';

export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase().replace(/\s+/g, '');
}

export function computePasswordVersion(hash: string): string {
  return crypto.createHash('sha256').update(hash).digest('hex').slice(0, 12);
}

export function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  if (!salt || !expectedHashHex || salt === DISABLED_MARKER || expectedHashHex === DISABLED_MARKER) {
    return false;
  }
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
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<Record<string, unknown>>)
      .filter((u) => u && u.salt !== DISABLED_MARKER && u.hash !== DISABLED_MARKER)
      .map((u) => ({
        usuario: String(u.usuario || ''),
        nome: String(u.nome || ''),
        role: normalizarCargo(typeof u.role === 'string' ? u.role : undefined),
        salt: String(u.salt || ''),
        hash: String(u.hash || ''),
        criadoEm: String(u.criadoEm || new Date().toISOString()),
      }));
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
  role: string;
  salt: string;
  hash: string;
  criado_em: string;
};

function mapRowToStoredUser(row: DbUserRow): StoredUser {
  return {
    usuario: row.usuario,
    nome: row.nome,
    role: normalizarCargo(row.role),
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
          users: (data as DbUserRow[])
            .filter((r) => r.salt !== DISABLED_MARKER && r.hash !== DISABLED_MARKER)
            .map(mapRowToStoredUser),
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
): Promise<{ user: StoredUser | null; storageMode: UserStorageMode; queryFailed?: boolean }> {
  const sb = getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('usuarios')
        .select('usuario, nome, role, salt, hash, criado_em')
        .eq('usuario', usuario)
        .maybeSingle();

      if (!error) {
        if (!data) {
          return { user: null, storageMode: 'supabase' };
        }
        const row = data as DbUserRow;
        if (row.salt === DISABLED_MARKER || row.hash === DISABLED_MARKER) {
          return { user: null, storageMode: 'supabase' };
        }
        return {
          user: mapRowToStoredUser(row),
          storageMode: 'supabase',
        };
      }

      if (!isMissingTableError(error)) {
        console.warn('Erro ao buscar usuário no Supabase:', error.message);
        return { user: null, storageMode: 'supabase', queryFailed: true };
      }
    } catch (e) {
      console.warn('Falha ao buscar usuário no Supabase:', e);
      return { user: null, storageMode: 'supabase', queryFailed: true };
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
      // Verifica se existe um registro previamente desativado com o mesmo login
      const { data: existente } = await sb
        .from('usuarios')
        .select('usuario, salt, hash')
        .eq('usuario', user.usuario)
        .maybeSingle();

      if (existente && (existente.salt === DISABLED_MARKER || existente.hash === DISABLED_MARKER)) {
        let updateRes = await sb
          .from('usuarios')
          .update({
            nome: user.nome,
            role: user.role,
            salt: user.salt,
            hash: user.hash,
            criado_em: criadoEm,
          })
          .eq('usuario', user.usuario)
          .select('usuario, nome, role, salt, hash, criado_em')
          .single();

        if (updateRes.error?.code === '23514' && user.role !== 'cliente') {
          updateRes = await sb
            .from('usuarios')
            .update({
              nome: user.nome,
              role: cargoParaDbFallback(user.role),
              salt: user.salt,
              hash: user.hash,
              criado_em: criadoEm,
            })
            .eq('usuario', user.usuario)
            .select('usuario, nome, role, salt, hash, criado_em')
            .single();
        }

        if (!updateRes.error && updateRes.data) {
          getRevokedUsersMap().delete(user.usuario);
          return {
            created: mapRowToStoredUser(updateRes.data as DbUserRow),
            storageMode: 'supabase',
          };
        }
      }

      let insertRes = await sb
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

      if (insertRes.error?.code === '23514' && user.role !== 'cliente') {
        insertRes = await sb
          .from('usuarios')
          .insert([
            {
              usuario: user.usuario,
              nome: user.nome,
              role: cargoParaDbFallback(user.role),
              salt: user.salt,
              hash: user.hash,
              criado_em: criadoEm,
            },
          ])
          .select('usuario, nome, role, salt, hash, criado_em')
          .single();
      }

      if (!insertRes.error && insertRes.data) {
        getRevokedUsersMap().delete(user.usuario);
        return {
          created: mapRowToStoredUser(insertRes.data as DbUserRow),
          storageMode: 'supabase',
        };
      }

      if (insertRes.error?.code === '23505') {
        throw new Error('DUPLICATE_USER');
      }

      if (insertRes.error?.code === '23514') {
        throw new Error(
          'Execute o script atualizado em supabase/schema.sql no Supabase para habilitar o cargo Cliente.'
        );
      }

      if (!isMissingTableError(insertRes.error)) {
        throw new Error(insertRes.error?.message || 'Erro ao gravar usuário no Supabase.');
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
  getRevokedUsersMap().delete(user.usuario);
  return { created: novo, storageMode: 'local' };
}

export async function updateStoredUser(
  usuarioAtual: string,
  updates: {
    novoUsuario?: string;
    nome?: string;
    role?: CargoUsuario;
    salt?: string;
    hash?: string;
  }
): Promise<{ updated: StoredUser; storageMode: UserStorageMode; credentialsChanged: boolean }> {
  const targetNovoUsuario = updates.novoUsuario ? normalizarUsuario(updates.novoUsuario) : usuarioAtual;
  const renomeou = targetNovoUsuario !== usuarioAtual;
  const trocouSenha = Boolean(updates.salt && updates.hash);
  const credentialsChanged = renomeou || trocouSenha;

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { data: atualData, error: findErr } = await sb
        .from('usuarios')
        .select('usuario, nome, role, salt, hash, criado_em')
        .eq('usuario', usuarioAtual)
        .maybeSingle();

      if (!findErr) {
        if (!atualData || atualData.salt === DISABLED_MARKER || atualData.hash === DISABLED_MARKER) {
          throw new Error('USER_NOT_FOUND');
        }

        if (renomeou) {
          const { data: conflito } = await sb
            .from('usuarios')
            .select('usuario, salt, hash')
            .eq('usuario', targetNovoUsuario)
            .maybeSingle();

          if (conflito && conflito.salt !== DISABLED_MARKER && conflito.hash !== DISABLED_MARKER) {
            throw new Error('DUPLICATE_USER');
          }
          if (conflito && (conflito.salt === DISABLED_MARKER || conflito.hash === DISABLED_MARKER)) {
            await sb.from('usuarios').delete().eq('usuario', targetNovoUsuario);
          }
        }

        const roleFinal = updates.role ? updates.role : normalizarCargo(atualData.role as string);
        const payloadUpdate: Record<string, string> = {
          usuario: targetNovoUsuario,
          nome: updates.nome !== undefined ? updates.nome : (atualData.nome as string),
          role: roleFinal,
        };
        if (updates.salt && updates.hash) {
          payloadUpdate.salt = updates.salt;
          payloadUpdate.hash = updates.hash;
        }

        let updateRes = await sb
          .from('usuarios')
          .update(payloadUpdate)
          .eq('usuario', usuarioAtual)
          .select('usuario, nome, role, salt, hash, criado_em')
          .single();

        if (updateRes.error?.code === '23514' && roleFinal !== 'cliente') {
          updateRes = await sb
            .from('usuarios')
            .update({ ...payloadUpdate, role: cargoParaDbFallback(roleFinal) })
            .eq('usuario', usuarioAtual)
            .select('usuario, nome, role, salt, hash, criado_em')
            .single();
        }

        if (updateRes.error?.code === '23505') {
          throw new Error('DUPLICATE_USER');
        }
        if (updateRes.error?.code === '23514') {
          throw new Error(
            'Execute o script atualizado em supabase/schema.sql no Supabase para habilitar o cargo Cliente.'
          );
        }
        if (updateRes.error || !updateRes.data) {
          throw new Error(updateRes.error?.message || 'Erro ao atualizar usuário no Supabase.');
        }

        if (credentialsChanged) {
          await revokeUserSessions(usuarioAtual);
          if (renomeou) {
            await revokeUserSessions(targetNovoUsuario);
          }
        } else if (updates.role || updates.nome !== undefined) {
          await sb
            .from('sessoes')
            .update({
              nome: payloadUpdate.nome,
              role: roleFinal,
            })
            .eq('usuario', targetNovoUsuario);
        }

        return {
          updated: mapRowToStoredUser(updateRes.data as DbUserRow),
          storageMode: 'supabase',
          credentialsChanged,
        };
      }

      if (!isMissingTableError(findErr)) {
        throw new Error(findErr.message || 'Erro ao buscar usuário no Supabase.');
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'USER_NOT_FOUND' ||
          err.message === 'DUPLICATE_USER' ||
          !err.message.toLowerCase().includes('does not exist'))
      ) {
        throw err;
      }
    }
  }

  const localUsers = readLocalUsers();
  const idx = localUsers.findIndex((u) => u.usuario === usuarioAtual);
  if (idx < 0) {
    throw new Error('USER_NOT_FOUND');
  }
  if (renomeou && localUsers.some((u) => u.usuario === targetNovoUsuario)) {
    throw new Error('DUPLICATE_USER');
  }

  const atual = localUsers[idx];
  const atualizado: StoredUser = {
    ...atual,
    usuario: targetNovoUsuario,
    nome: updates.nome !== undefined ? updates.nome : atual.nome,
    role: updates.role ?? atual.role,
    salt: updates.salt || atual.salt,
    hash: updates.hash || atual.hash,
  };
  localUsers[idx] = atualizado;
  writeLocalUsers(localUsers);

  if (credentialsChanged) {
    await revokeUserSessions(usuarioAtual);
    if (renomeou) {
      await revokeUserSessions(targetNovoUsuario);
    }
  }

  return { updated: atualizado, storageMode: 'local', credentialsChanged };
}

export async function deleteStoredUser(
  usuario: string
): Promise<{ deleted: boolean; storageMode: UserStorageMode }> {
  const sb = getServerSupabase();

  if (sb) {
    try {
      const { data: deletedRows, error: delErr } = await sb
        .from('usuarios')
        .delete()
        .eq('usuario', usuario)
        .select('usuario');

      if (!delErr && deletedRows && deletedRows.length > 0) {
        await revokeUserSessions(usuario);
        return { deleted: true, storageMode: 'supabase' };
      }

      // Fallback se o RLS ainda não tiver política de DELETE aplicada no Supabase:
      // desativa definitivamente a conta na tabela usuarios via UPDATE
      const { data: updatedRows, error: updErr } = await sb
        .from('usuarios')
        .update({
          salt: DISABLED_MARKER,
          hash: DISABLED_MARKER,
        })
        .eq('usuario', usuario)
        .select('usuario');

      if (!updErr && updatedRows && updatedRows.length > 0) {
        await revokeUserSessions(usuario);
        return { deleted: true, storageMode: 'supabase' };
      }

      if (delErr && !isMissingTableError(delErr)) {
        throw new Error(delErr.message || 'Erro ao excluir usuário no Supabase.');
      }
      if (updErr && !isMissingTableError(updErr)) {
        throw new Error(updErr.message || 'Erro ao desativar usuário no Supabase.');
      }
    } catch (err) {
      if (err instanceof Error && !err.message.toLowerCase().includes('does not exist')) {
        throw err;
      }
    }
  }

  const localUsers = readLocalUsers();
  const filtrados = localUsers.filter((u) => u.usuario !== usuario);
  if (filtrados.length === localUsers.length) {
    return { deleted: false, storageMode: 'local' };
  }
  writeLocalUsers(filtrados);
  await revokeUserSessions(usuario);
  return { deleted: true, storageMode: 'local' };
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
    configured: users.some((u) => u.role === 'administrador' || u.usuario === 'admin'),
    storageMode,
  };
}

export type SessionPayload = {
  usuario: string;
  nome: string;
  role: CargoUsuario;
  iat?: number;
  ver?: string;
  exp: number;
};

type StoredSessionRecord = {
  tokenHash: string;
  usuario: string;
  nome: string;
  role: CargoUsuario;
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
    return (parsed as Array<Record<string, unknown>>)
      .filter((s) => s && typeof s.tokenHash === 'string' && typeof s.exp === 'number' && s.exp > now)
      .map((s) => ({
        tokenHash: String(s.tokenHash),
        usuario: String(s.usuario || ''),
        nome: String(s.nome || ''),
        role: normalizarCargo(typeof s.role === 'string' ? s.role : undefined),
        exp: Number(s.exp),
      }));
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

export function createSessionToken(payload: Omit<SessionPayload, 'exp' | 'iat'>): string {
  const now = Date.now();
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export async function saveSessionRecord(
  token: string,
  payload: Omit<SessionPayload, 'exp' | 'iat'>
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
      let upsertRes = await sb.from('sessoes').upsert(
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

      if (upsertRes.error?.code === '23514' && payload.role !== 'cliente') {
        upsertRes = await sb.from('sessoes').upsert(
          [
            {
              token_hash: tokenHash,
              usuario: payload.usuario,
              nome: payload.nome,
              role: cargoParaDbFallback(payload.role),
              expira_em: new Date(exp).toISOString(),
            },
          ],
          { onConflict: 'token_hash' }
        );
      }

      if (upsertRes.error && !isMissingTableError(upsertRes.error)) {
        console.warn('Erro ao salvar sessão no Supabase:', upsertRes.error.message);
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

export async function revokeUserSessions(usuario: string): Promise<void> {
  const norm = normalizarUsuario(usuario);
  if (!norm) return;
  getRevokedUsersMap().set(norm, Date.now());

  const localSessions = readLocalSessions();
  for (const s of localSessions) {
    if (s.usuario === norm) {
      getRevokedHashesSet().add(s.tokenHash);
    }
  }
  writeLocalSessions(localSessions.filter((s) => s.usuario !== norm));

  const sb = getServerSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('sessoes').delete().eq('usuario', norm);
      if (error && !isMissingTableError(error)) {
        console.warn('Erro ao revogar sessões do usuário no Supabase:', error.message);
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
            role: normalizarCargo(data.role as string),
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
    const revokedAt = getRevokedUsersMap().get(parsed.usuario);
    if (revokedAt && (!parsed.iat || parsed.iat < revokedAt)) {
      return null;
    }
    return {
      ...parsed,
      role: normalizarCargo(parsed.role),
    };
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

async function verifyActiveUserRecord(
  usuario: string,
  tokenVersion?: string
): Promise<
  | { status: 'active'; nome: string; role: CargoUsuario }
  | { status: 'inactive' }
  | { status: 'unknown' }
> {
  const envAdmin = getEnvAdminConfig();
  if (envAdmin && envAdmin.username === usuario) {
    return { status: 'active', nome: 'Administrador', role: 'administrador' };
  }

  const { user, queryFailed } = await findStoredUser(usuario);
  if (queryFailed) {
    return { status: 'unknown' };
  }
  if (!user) {
    return { status: 'inactive' };
  }
  if (tokenVersion && computePasswordVersion(user.hash) !== tokenVersion) {
    return { status: 'inactive' };
  }
  return {
    status: 'active',
    nome: user.nome || user.usuario,
    role: user.role,
  };
}

export async function resolveSessionFromRequest(
  req: NextRequest
): Promise<{ session: SessionPayload; token: string } | null> {
  const authHeader = req.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value || null;

  const candidatos = [bearerToken, cookieToken].filter((t): t is string => Boolean(t));

  for (const token of candidatos) {
    const tokenHash = hashSessionToken(token);
    if (getRevokedHashesSet().has(tokenHash)) continue;

    const signed = verifySessionToken(token);
    const stored = await findPersistedSession(token);
    const baseSession = stored || signed;
    if (!baseSession) continue;

    const revokedAt = getRevokedUsersMap().get(baseSession.usuario);
    if (revokedAt && (!signed?.iat || signed.iat < revokedAt)) {
      continue;
    }

    const activeCheck = await verifyActiveUserRecord(baseSession.usuario, signed?.ver);
    if (activeCheck.status === 'inactive') {
      await revokeSessionRecord(token);
      continue;
    }

    if (activeCheck.status === 'active') {
      return {
        session: {
          ...baseSession,
          nome: activeCheck.nome,
          role: activeCheck.role,
        },
        token,
      };
    }

    return { session: baseSession, token };
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
