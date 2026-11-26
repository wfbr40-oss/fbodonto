import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminConfigured } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const adminConfigured = isAdminConfigured();

  if (!session) {
    return NextResponse.json({
      autenticado: false,
      usuario: null,
      role: null,
      adminConfigured,
    });
  }

  return NextResponse.json({
    autenticado: true,
    usuario: session.nome || session.usuario,
    role: session.role,
    adminConfigured,
  });
}
