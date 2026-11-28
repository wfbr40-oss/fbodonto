import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  clearSessionCookie,
  extractTokenFromRequest,
  isAdminConfigured,
  resolveSessionFromRequest,
  touchSessionRecord,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolvido = await resolveSessionFromRequest(req);
  const { configured: adminConfigured, storageMode } = await isAdminConfigured();

  if (!resolvido) {
    const res = NextResponse.json(
      {
        autenticado: false,
        usuario: null,
        usuarioLogin: null,
        role: null,
        adminConfigured,
        storageMode,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      }
    );
    if (extractTokenFromRequest(req)) {
      clearSessionCookie(res);
    }
    return res;
  }

  const { session, token } = resolvido;
  await touchSessionRecord(token);

  const res = NextResponse.json(
    {
      autenticado: true,
      usuario: session.nome || session.usuario,
      usuarioLogin: session.usuario,
      role: session.role,
      adminConfigured,
      storageMode,
      token,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    }
  );
  attachSessionCookie(res, token);
  return res;
}
