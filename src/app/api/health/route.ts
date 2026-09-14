import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const maxDuration = 10;

export async function GET() {
  const startTime = Date.now();
  let dbStatus = false;
  
  try {
    // 1. Check DB
    await db.$queryRaw`SELECT 1`;
    dbStatus = true;
    
    // 2. Check LLM provider
    const nimStatus = !!env.nvidia.apiKey;
    
    const isHealthy = dbStatus && nimStatus;
    
    const response = {
      status: isHealthy ? 'ok' : 'error',
      db: dbStatus,
      nim: nimStatus,
      version: process.env.npm_package_version || '1.0.0',
      uptimeMs: Math.floor(process.uptime() * 1000),
      latencyMs: Date.now() - startTime,
    };
    
    return NextResponse.json(response, { status: isHealthy ? 200 : 503 });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      db: dbStatus,
    }, { status: 503 });
  }
}
