import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  createSessionToken,
  findStoredUser,
  getEnvAdminConfig,
  normalizarUsuario,
  saveSessionRecord,
  timingSafeEqualStr,
  verifyPassword,
  verifySameOriginMutation,
} from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  let body: { usuario?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const usuarioLimpo = normalizarUsuario(body.usuario || '');
  const senha = body.senha || '';

  if (!usuarioLimpo || !senha) {
    return NextResponse.json({ error: 'Preencha usuário e senha.' }, { status: 400 });
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin && usuarioLimpo === envAdmin.username) {
    if (!timingSafeEqualStr(senha, envAdmin.password)) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
    }
    const payloadSessao = {
      usuario: envAdmin.username,
      nome: 'Administrador',
      role: 'admin' as const,
    };
    const token = createSessionToken(payloadSessao);
    await saveSessionRecord(token, payloadSessao);
    const res = NextResponse.json({
      autenticado: true,
      usuario: 'Administrador',
      usuarioLogin: envAdmin.username,
      role: 'admin',
      token,
    });
    attachSessionCookie(res, token);
    return res;
  }

  const { user: encontrado } = await findStoredUser(usuarioLimpo);

  if (!encontrado || !verifyPassword(senha, encontrado.salt, encontrado.hash)) {
    return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
  }

  const nomeExibicao = encontrado.nome || encontrado.usuario;
  const payloadSessao = {
    usuario: encontrado.usuario,
    nome: nomeExibicao,
    role: encontrado.role,
  };
  const token = createSessionToken(payloadSessao);
  await saveSessionRecord(token, payloadSessao);

  const res = NextResponse.json({
    autenticado: true,
    usuario: nomeExibicao,
    usuarioLogin: encontrado.usuario,
    role: encontrado.role,
    token,
  });
  attachSessionCookie(res, token);
  return res;
}
