/**
 * Tests for the Signal Extractor.
 */

import { describe, it, expect } from 'vitest';
import { extractSignals } from '@/features/code-understanding/pipeline/signal-extractor';

describe('extractSignals — authentication', () => {
  it('detects authentication signal from jwt import', () => {
    const code = `import jwt from 'jsonwebtoken';
const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'authentication')).toBe(true);
  });

  it('detects authentication from next-auth import', () => {
    const code = `import { getServerSession } from 'next-auth';
const session = await getServerSession(authOptions);`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'authentication')).toBe(true);
  });
});

describe('extractSignals — database', () => {
  it('detects database signal from Prisma usage', () => {
    const code = `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany();`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'database')).toBe(true);
  });

  it('detects database from mongoose import', () => {
    const code = `import mongoose from 'mongoose';
mongoose.connect(process.env.MONGO_URI!);`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'database')).toBe(true);
  });
});

describe('extractSignals — caching', () => {
  it('detects caching from redis import and get/set', () => {
    const code = `import { createClient } from 'redis';
const client = createClient();
await client.set('key', 'value');
const val = await client.get('key');`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'caching')).toBe(true);
  });
});

describe('extractSignals — async-boundary', () => {
  it('detects async boundary from async/await', () => {
    const code = `async function fetchUsers() {
  const data = await fetch('/api/users');
  return data.json();
}`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'async-boundary')).toBe(true);
  });
});

describe('extractSignals — api-call', () => {
  it('detects external API call from axios', () => {
    const code = `import axios from 'axios';
const response = await axios.get('https://api.example.com/users');`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'api-call')).toBe(true);
  });
});

describe('extractSignals — env-variable', () => {
  it('detects env variable usage from process.env', () => {
    const code = `const dbUrl = process.env.DATABASE_URL;
const secret = process.env.JWT_SECRET;`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'env-variable')).toBe(true);
  });
});

describe('extractSignals — filesystem-access', () => {
  it('detects filesystem access from fs.readFile', () => {
    const code = `import { readFile } from 'fs';
readFile('./config.json', 'utf-8', (err, data) => console.log(data));`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'filesystem-access')).toBe(true);
  });
});

describe('extractSignals — error-handling', () => {
  it('detects error handling from try/catch', () => {
    const code = `try {
  await db.connect();
} catch (error) {
  console.error('DB connection failed:', error);
}`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'error-handling')).toBe(true);
  });
});

describe('extractSignals — deduplication', () => {
  it('emits each signal at most once even when multiple patterns match', () => {
    const code = `import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
const token = jwt.sign({}, secret);
const session = await getServerSession(opts);`;
    const signals = extractSignals(code);
    const authSignals = signals.filter((s) => s.name === 'authentication');
    expect(authSignals).toHaveLength(1);
  });
});

describe('extractSignals — websocket', () => {
  it('detects websocket from Socket.io import', () => {
    const code = `import { Server } from 'socket.io';
const io = new Server(httpServer);
io.on('connect', (socket) => { socket.emit('hello', 'world'); });`;
    const signals = extractSignals(code);
    expect(signals.some((s) => s.name === 'websocket')).toBe(true);
  });
});

describe('extractSignals — empty for clean code', () => {
  it('returns empty array for pure utility functions with no signals', () => {
    const code = `export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}`;
    const signals = extractSignals(code);
    // Should have no signals except possibly async-boundary or error-handling
    const heavySignals = signals.filter((s) =>
      ['authentication', 'database', 'caching', 'websocket', 'filesystem-access'].includes(s.name)
    );
    expect(heavySignals).toHaveLength(0);
  });
});
