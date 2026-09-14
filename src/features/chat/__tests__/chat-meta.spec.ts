import { describe, expect, it } from 'vitest';
import { extractTextFromParts, parseChatMeta, stripStreamError } from '../lib/chat-meta';
import type { ChatMeta } from '../lib/chat-meta';

function metaResponse(payload: unknown): Response {
  const encoded = btoa(JSON.stringify(payload));
  return new Response('ok', { headers: { 'x-chat-meta': encoded } });
}

describe('parseChatMeta', () => {
  it('returns null when the header is missing', () => {
    expect(parseChatMeta(new Response('ok'))).toBeNull();
  });

  it('returns null for malformed base64 or JSON', () => {
    expect(
      parseChatMeta(new Response('ok', { headers: { 'x-chat-meta': '!!!not-base64!!!' } })),
    ).toBeNull();
  });

  it('parses a full payload', () => {
    const payload: ChatMeta = {
      intent: 'trace_flow',
      status: 'grounded',
      evidence: [
        {
          id: 'E1',
          nodeId: 'n1',
          label: 'auth.ts:10',
          filePath: 'src/auth.ts',
          nodeName: 'verifyJWT',
          startLine: 10,
          endLine: 20,
        },
      ],
      followUps: ['What calls verifyJWT?'],
      stats: { lexicalHits: 3, semanticHits: 2, graphExpanded: 5 },
    };
    expect(parseChatMeta(metaResponse(payload))).toEqual(payload);
  });

  it('falls back to safe defaults for missing fields', () => {
    expect(parseChatMeta(metaResponse({}))).toEqual({
      intent: 'explain',
      status: 'grounded',
      evidence: [],
      followUps: [],
      stats: { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
    });
  });

  it('rejects unknown intent/status values from a tampered header', () => {
    const parsed = parseChatMeta(
      metaResponse({ intent: '<img src=x>', status: 'pwned', evidence: 'nope', followUps: null }),
    );
    expect(parsed?.intent).toBe('explain');
    expect(parsed?.status).toBe('grounded');
    expect(parsed?.evidence).toEqual([]);
    expect(parsed?.followUps).toEqual([]);
  });
});

describe('stripStreamError', () => {
  it('passes clean text through untouched', () => {
    expect(stripStreamError('Hello world')).toEqual(['Hello world', null]);
  });

  it('splits partial output from a trailing sentinel error', () => {
    const [text, error] = stripStreamError('Partial answer[__STREAM_ERROR__]provider timed out');
    expect(text).toBe('Partial answer');
    expect(error).toBe('provider timed out');
  });

  it('defaults the message when the sentinel carries no text', () => {
    const [text, error] = stripStreamError('Partial answer[__STREAM_ERROR__]');
    expect(text).toBe('Partial answer');
    expect(error).toBe('The model stream failed mid-response.');
  });
});

describe('extractTextFromParts', () => {
  it('joins text parts and ignores non-text parts', () => {
    expect(
      extractTextFromParts({
        parts: [
          { type: 'text', text: 'Hello ' },
          { type: 'tool-call', text: 'ignored' },
          { type: 'text', text: 'world' },
        ],
      }),
    ).toBe('Hello world');
  });

  it('falls back to content when no parts exist', () => {
    expect(extractTextFromParts({ content: 'fallback' })).toBe('fallback');
    expect(extractTextFromParts({})).toBe('');
  });
});
