import { NextRequest, NextResponse } from 'next/server';
import {
  createStoredUser,
  getEnvAdminConfig,
  hashPassword,
  listStoredUsers,
  normalizarUsuario,
  PublicUser,
  resolveSessionFromRequest,
  verifySameOriginMutation,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolvido = await resolveSessionFromRequest(req);
  if (!resolvido) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { users, storageMode } = await listStoredUsers();
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

  return NextResponse.json({ usuarios: lista, storageMode });
}

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  const resolvido = await resolveSessionFromRequest(req);
  if (!resolvido) {
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
  if (envAdmin && usuarioLimpo === envAdmin.username) {
    return NextResponse.json({ error: 'Este usuário já está cadastrado.' }, { status: 409 });
  }

  const { salt, hash } = hashPassword(senhaFinal);

  try {
    const { created, storageMode } = await createStoredUser({
      usuario: usuarioLimpo,
      nome: nomeLimpo,
      role: 'operador',
      salt,
      hash,
    });

    return NextResponse.json({
      usuario: {
        usuario: created.usuario,
        nome: created.nome,
        role: created.role,
        criadoEm: created.criadoEm,
      },
      storageMode,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_USER') {
      return NextResponse.json({ error: 'Este usuário já está cadastrado.' }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : 'Erro ao cadastrar usuário.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
