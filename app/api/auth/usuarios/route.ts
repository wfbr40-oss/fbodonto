import { NextRequest, NextResponse } from 'next/server';
import {
  CargoUsuario,
  createStoredUser,
  deleteStoredUser,
  getEnvAdminConfig,
  hashPassword,
  listStoredUsers,
  normalizarCargo,
  normalizarUsuario,
  PublicUser,
  resolveSessionFromRequest,
  updateStoredUser,
  verifySameOriginMutation,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolvido = await resolveSessionFromRequest(req);
  if (!resolvido) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (resolvido.session.role !== 'administrador') {
    return NextResponse.json(
      { error: 'Apenas administradores podem gerenciar usuários.' },
      { status: 403 }
    );
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
      role: 'administrador',
      criadoEm: new Date().toISOString(),
      protegido: true,
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
  if (resolvido.session.role !== 'administrador') {
    return NextResponse.json(
      { error: 'Apenas administradores podem cadastrar usuários.' },
      { status: 403 }
    );
  }

  let body: { usuario?: string; nome?: string; senha?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const usuarioLimpo = normalizarUsuario(body.usuario || '');
  const nomeLimpo = (body.nome || '').trim() || usuarioLimpo;
  const senhaFinal = (body.senha ?? '1234').trim() || '1234';
  const cargo: CargoUsuario = normalizarCargo(body.role);

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
      role: cargo,
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

export async function PATCH(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  const resolvido = await resolveSessionFromRequest(req);
  if (!resolvido) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (resolvido.session.role !== 'administrador') {
    return NextResponse.json(
      { error: 'Apenas administradores podem editar usuários.' },
      { status: 403 }
    );
  }

  let body: {
    usuarioAtual?: string;
    novoUsuario?: string;
    nome?: string;
    role?: string;
    novaSenha?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const usuarioAtual = normalizarUsuario(body.usuarioAtual || '');
  if (!usuarioAtual) {
    return NextResponse.json({ error: 'Usuário de origem não informado.' }, { status: 400 });
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin && usuarioAtual === envAdmin.username) {
    return NextResponse.json(
      { error: 'O administrador definido por variável de ambiente não pode ser editado aqui.' },
      { status: 400 }
    );
  }

  const novoUsuario = body.novoUsuario ? normalizarUsuario(body.novoUsuario) : usuarioAtual;
  if (!novoUsuario || novoUsuario.length < 2) {
    return NextResponse.json(
      { error: 'O login deve ter pelo menos 2 caracteres.' },
      { status: 400 }
    );
  }

  if (envAdmin && novoUsuario === envAdmin.username) {
    return NextResponse.json({ error: 'Este login já está em uso.' }, { status: 409 });
  }

  const cargo = body.role !== undefined ? normalizarCargo(body.role) : undefined;
  if (usuarioAtual === resolvido.session.usuario && cargo && cargo !== 'administrador') {
    return NextResponse.json(
      { error: 'Você não pode rebaixar o cargo do próprio administrador conectado.' },
      { status: 400 }
    );
  }

  const novaSenha = (body.novaSenha || '').trim();
  if (novaSenha && novaSenha.length < 4) {
    return NextResponse.json(
      { error: 'A nova senha deve ter pelo menos 4 caracteres.' },
      { status: 400 }
    );
  }

  let salt: string | undefined;
  let hash: string | undefined;
  if (novaSenha) {
    const gerado = hashPassword(novaSenha);
    salt = gerado.salt;
    hash = gerado.hash;
  }

  try {
    const { updated, storageMode, credentialsChanged } = await updateStoredUser(usuarioAtual, {
      novoUsuario,
      nome: body.nome !== undefined ? body.nome.trim() || novoUsuario : undefined,
      role: cargo,
      salt,
      hash,
    });

    return NextResponse.json({
      usuario: {
        usuario: updated.usuario,
        nome: updated.nome,
        role: updated.role,
        criadoEm: updated.criadoEm,
      },
      storageMode,
      credentialsChanged,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    if (err instanceof Error && err.message === 'DUPLICATE_USER') {
      return NextResponse.json({ error: 'Este login já está cadastrado.' }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar usuário.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }

  const resolvido = await resolveSessionFromRequest(req);
  if (!resolvido) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (resolvido.session.role !== 'administrador') {
    return NextResponse.json(
      { error: 'Apenas administradores podem excluir logins.' },
      { status: 403 }
    );
  }

  let usuarioAlvo = '';
  try {
    const body = (await req.json()) as { usuario?: string };
    usuarioAlvo = normalizarUsuario(body.usuario || '');
  } catch {
    usuarioAlvo = normalizarUsuario(req.nextUrl.searchParams.get('usuario') || '');
  }

  if (!usuarioAlvo) {
    return NextResponse.json({ error: 'Informe o login a ser excluído.' }, { status: 400 });
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin && usuarioAlvo === envAdmin.username) {
    return NextResponse.json(
      { error: 'O administrador definido por variável de ambiente não pode ser excluído.' },
      { status: 400 }
    );
  }

  if (usuarioAlvo === resolvido.session.usuario) {
    return NextResponse.json(
      { error: 'Você não pode excluir o próprio login conectado.' },
      { status: 400 }
    );
  }

  try {
    const { deleted, storageMode } = await deleteStoredUser(usuarioAlvo);
    if (!deleted) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, usuario: usuarioAlvo, storageMode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao excluir usuário.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
