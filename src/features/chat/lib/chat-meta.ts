export type ChatIntentClient =
  | 'locate'
  | 'explain'
  | 'trace_flow'
  | 'architecture'
  | 'dependency'
  | 'impact'
  | 'debug'
  | 'compare';

export type AnswerStatusClient = 'grounded' | 'limited_evidence' | 'not_found';

export interface EvidenceChip {
  id: string;
  nodeId: string;
  label: string;
  filePath: string | null;
  nodeName: string;
  startLine: number | null;
  endLine: number | null;
}

export interface ChatMeta {
  intent: ChatIntentClient;
  status: AnswerStatusClient;
  evidence: EvidenceChip[];
  followUps: string[];
  stats: { lexicalHits: number; semanticHits: number; graphExpanded: number };
}

const STREAM_ERROR_SENTINEL = '[__STREAM_ERROR__]';

const KNOWN_INTENTS: ReadonlySet<string> = new Set([
  'locate',
  'explain',
  'trace_flow',
  'architecture',
  'dependency',
  'impact',
  'debug',
  'compare',
]);

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  'grounded',
  'limited_evidence',
  'not_found',
]);

/** Parse the base64 `x-chat-meta` response header into a typed payload. */
export function parseChatMeta(res: Response): ChatMeta | null {
  const header = res.headers.get('x-chat-meta');
  if (!header) return null;
  try {
    const raw = JSON.parse(atob(header)) as Partial<ChatMeta>;
    const intent: ChatIntentClient =
      raw.intent && KNOWN_INTENTS.has(raw.intent) ? raw.intent : 'explain';
    const status: AnswerStatusClient =
      raw.status && KNOWN_STATUSES.has(raw.status) ? raw.status : 'grounded';
    return {
      intent,
      status,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
      followUps: Array.isArray(raw.followUps) ? raw.followUps : [],
      stats: raw.stats ?? { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
    };
  } catch {
    return null;
  }
}

/** Extract plain text from an AI SDK message (parts-first, content fallback). */
export function extractTextFromParts(msg: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
}): string {
  if (msg.parts && msg.parts.length > 0) {
    return msg.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text ?? '')
      .join('');
  }
  return msg.content ?? '';
}

/**
 * Strip a mid-stream sentinel the route appends when the provider fails after
 * the 200 was already sent. Returns [cleanText, errorMessage | null].
 */
export function stripStreamError(text: string): [string, string | null] {
  const idx = text.indexOf(STREAM_ERROR_SENTINEL);
  if (idx === -1) return [text, null];
  return [
    text.slice(0, idx).trim(),
    text.slice(idx + STREAM_ERROR_SENTINEL.length).trim() || 'The model stream failed mid-response.',
  ];
}

export const INTENT_LABELS: Record<ChatIntentClient, string> = {
  locate: 'Locate',
  explain: 'Explain',
  trace_flow: 'Trace flow',
  architecture: 'Architecture',
  dependency: 'Dependencies',
  impact: 'Impact',
  debug: 'Debug',
  compare: 'Compare',
};

export const STATUS_LABELS: Record<AnswerStatusClient, { title: string; detail: string }> = {
  grounded: {
    title: 'Grounded in the repository',
    detail: 'This answer is built from indexed source evidence. Citations resolve to real file:line locations.',
  },
  limited_evidence: {
    title: 'Limited evidence',
    detail: 'Only a small amount of indexed evidence was found for this question. Parts of this answer are best-effort — ask a more targeted question if it feels thin.',
  },
  not_found: {
    title: 'No direct evidence found',
    detail: 'The index did not surface strong support for this question. The codebase may not contain this, or the repo may need a fresh sync.',
  },
};