import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { GraphNodeType } from '@prisma/client';

type RouteParams = { params: Promise<{ repoId: string }> };

/**
 * GET /api/github/repos/[repoId]/chat/evidence?nodeId=<nodeId>
 * Returns the full evidence payload for a single graph node so the client can
 * render a source viewer overlay without exposing graph internals or raw DB
 * row shapes. Ownership verified via session + repository membership.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!(await checkRateLimit(`evidence:${session.user.id}`, { windowMs: 60_000, maxRequests: 120 })).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 });
  }

  const { repoId } = await params;
  const nodeId = request.nextUrl.searchParams.get('nodeId');
  if (!nodeId) {
    return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
  }

  try {
    const repo = await db.repository.findFirst({ where: { id: repoId, user_id: session.user.id } });
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const node = await db.graphNode.findUnique({ where: { id: nodeId } });
    if (!node || node.repo_id !== repo.id) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    const file = node.file_id
      ? await db.file.findUnique({ where: { id: node.file_id }, select: { path: true } })
      : null;

    return NextResponse.json({
      nodeId: node.id,
      nodeName: node.name,
      type: node.type as GraphNodeType,
      filePath: file?.path ?? (node.type === 'FILE' ? node.name : null),
      signature: node.signature,
      codeSnippet: node.code_snippet,
      startLine: node.start_line,
      endLine: node.end_line,
      documentation: node.documentation,
    });
  } catch (err) {
    console.error('[Chat][Evidence] failed', err);
    return NextResponse.json({ error: 'Could not load evidence' }, { status: 500 });
  }
}