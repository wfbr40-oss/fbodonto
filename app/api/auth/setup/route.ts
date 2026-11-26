import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  createSessionToken,
  hashPassword,
  isAdminConfigured,
  normalizarUsuario,
  readStoredUsers,
  verifySameOriginMutation,
  writeStoredUsers,
} from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  if (isAdminConfigured()) {
    return NextResponse.json(
      { error: 'O acesso administrativo inicial já foi configurado.' },
      { status: 403 }
    );
  }

  let body: { usuario?: string; nome?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const usuarioLimpo = normalizarUsuario(body.usuario || 'admin') || 'admin';
  const nomeLimpo = (body.nome || 'Administrador').trim() || 'Administrador';
  const senha = (body.senha || '').trim();

  if (senha.length < 4) {
    return NextResponse.json(
      { error: 'A senha do administrador deve ter pelo menos 4 caracteres.' },
      { status: 400 }
    );
  }

  const { salt, hash } = hashPassword(senha);
  const existing = readStoredUsers();
  existing.push({
    usuario: usuarioLimpo,
    nome: nomeLimpo,
    role: 'admin',
    salt,
    hash,
    criadoEm: new Date().toISOString(),
  });
  writeStoredUsers(existing);

  const token = createSessionToken({
    usuario: usuarioLimpo,
    nome: nomeLimpo,
    role: 'admin',
  });

  const res = NextResponse.json({
    autenticado: true,
    usuario: nomeLimpo,
    role: 'admin',
    token,
  });
  attachSessionCookie(res, token);
  return res;
}
