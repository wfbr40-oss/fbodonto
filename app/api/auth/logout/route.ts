import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  extractTokenFromRequest,
  revokeSessionRecord,
  verifySameOriginMutation,
} from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  if (!verifySameOriginMutation(req)) {
    return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
  }
  const token = extractTokenFromRequest(req);
  await revokeSessionRecord(token);

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
