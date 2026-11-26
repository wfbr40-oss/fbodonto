import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminConfigured } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const { configured: adminConfigured, storageMode } = await isAdminConfigured();

  if (!session) {
    return NextResponse.json({
      autenticado: false,
      usuario: null,
      role: null,
      adminConfigured,
      storageMode,
    });
  }

  return NextResponse.json({
    autenticado: true,
    usuario: session.nome || session.usuario,
    role: session.role,
    adminConfigured,
    storageMode,
  });
}
