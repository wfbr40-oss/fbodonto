import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvAdminConfig,
  getSessionFromRequest,
  hashPassword,
  normalizarUsuario,
  PublicUser,
  readStoredUsers,
  verifySameOriginMutation,
  writeStoredUsers,
} from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const users = readStoredUsers();
  const lista: PublicUser[] = users.map((u) => ({
    usuario: u.usuario,
    nome: u.nome,
    role: u.role,
    criadoEm: u.criadoEm,
  }));

  const envAdmin = getEnvAdminConfig();
  if (envAdmin && !lista.some((u) => u.usuario === envAdmin.username)) {
    lista.unshift({
      usuario: envAdmin.username,
      nome: 'Administrador',
      role: 'admin',
      criadoEm: new Date().toISOString(),
    });
  }

  return NextResponse.json({ usuarios: lista });
}

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: { usuario?: string; nome?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const usuarioLimpo = normalizarUsuario(body.usuario || '');
  const nomeLimpo = (body.nome || '').trim() || usuarioLimpo;
  const senhaFinal = (body.senha ?? '1234').trim() || '1234';

  if (!usuarioLimpo || usuarioLimpo.length < 2) {
    return NextResponse.json(
      { error: 'Informe um nome de usuário válido (mínimo 2 caracteres).' },
      { status: 400 }
    );
  }

  if (senhaFinal.length < 4) {
    return NextResponse.json(
      { error: 'A senha deve ter pelo menos 4 caracteres.' },
      { status: 400 }
    );
  }

  const envAdmin = getEnvAdminConfig();
  const users = readStoredUsers();

  if ((envAdmin && usuarioLimpo === envAdmin.username) || users.some((u) => u.usuario === usuarioLimpo)) {
    return NextResponse.json({ error: 'Este usuário já está cadastrado.' }, { status: 409 });
  }

  const { salt, hash } = hashPassword(senhaFinal);
  const novoUsuario = {
    usuario: usuarioLimpo,
    nome: nomeLimpo,
    role: 'operador' as const,
    salt,
    hash,
    criadoEm: new Date().toISOString(),
  };

  users.push(novoUsuario);
  writeStoredUsers(users);

  return NextResponse.json({
    usuario: {
      usuario: novoUsuario.usuario,
      nome: novoUsuario.nome,
      role: novoUsuario.role,
      criadoEm: novoUsuario.criadoEm,
    },
  });
}
