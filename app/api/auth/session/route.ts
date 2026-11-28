import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  isAdminConfigured,
  resolveSessionFromRequest,
  touchSessionRecord,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolvido = await resolveSessionFromRequest(req);
  const { configured: adminConfigured, storageMode } = await isAdminConfigured();

  if (!resolvido) {
    return NextResponse.json(
      {
        autenticado: false,
        usuario: null,
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
