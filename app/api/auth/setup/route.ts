import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  createSessionToken,
  createStoredUser,
  hashPassword,
  isAdminConfigured,
  normalizarUsuario,
  saveSessionRecord,
  verifySameOriginMutation,
} from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  const { configured } = await isAdminConfigured();
  if (configured) {
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
  let storageMode: 'supabase' | 'local' = 'local';
  try {
    const result = await createStoredUser({
      usuario: usuarioLimpo,
      nome: nomeLimpo,
      role: 'admin',
      salt,
      hash,
    });
    storageMode = result.storageMode;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao salvar administrador.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const payloadSessao = {
    usuario: usuarioLimpo,
    nome: nomeLimpo,
    role: 'admin' as const,
  };
  const token = createSessionToken(payloadSessao);
  await saveSessionRecord(token, payloadSessao);

  const res = NextResponse.json({
    autenticado: true,
    usuario: nomeLimpo,
    usuarioLogin: usuarioLimpo,
    role: 'admin',
    storageMode,
    token,
  });
  attachSessionCookie(res, token);
  return res;
}
