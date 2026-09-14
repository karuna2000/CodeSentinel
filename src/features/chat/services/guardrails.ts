/**
 * Pure guardrail gates for chat answers (spec §5, Phase A).
 *
 * These run on the COMPLETED answer text before any byte is streamed to the
 * client, so a FAIL can still block the output. All functions are pure and
 * synchronous — unit-tested in `__tests__/guardrails.spec.ts`.
 *
 * Gates:
 * - citation_coverage: every `[E*]` tag must resolve to the evidence index,
 *   and substantive answers grounded in evidence must cite at least one tag.
 * - secrets_leak: key-like material (private keys, tokens, assignments)
 *   must never leave the server. Mere mentions of ".env" do NOT trip this —
 *   only secret-shaped values do.
 */

export type GateId = 'citation_coverage' | 'secrets_leak';

export interface GateResult {
  gate: GateId;
  pass: boolean;
  detail: string;
}

export interface GuardrailVerdict {
  /** True when every gate passed. */
  pass: boolean;
  /** True when the answer must be replaced by the fallback (any gate failed). */
  blocked: boolean;
  results: GateResult[];
  /** Citation tags found in the answer (e.g. ["E1", "E3"]). */
  citedTags: string[];
}

/** Fallback served when a gate fails — never an ungrounded answer. */
export const BLOCKED_FALLBACK =
  "I couldn't find evidence in the repository for this question. Try rephrasing or check Sources.";

const CITATION_RE = /\[E(\d+)\]/g;

/**
 * Below this length an answer is treated as conversational ("You're welcome!")
 * rather than a factual claim, and is exempt from the must-cite rule.
 * Unknown-tag references are still rejected at any length.
 */
export const SUBSTANTIVE_MIN_CHARS = 120;

/** Extract citation tags (`E1`, `E2`, …) referenced by an answer. */
export function extractCitedTags(answer: string): string[] {
  const tags: string[] = [];
  for (const match of answer.matchAll(CITATION_RE)) {
    tags.push(`E${match[1]}`);
  }
  return [...new Set(tags)];
}

export function checkCitationCoverage(
  answer: string,
  validTagIds: ReadonlySet<string> | readonly string[],
  evidenceCount: number,
): GateResult {
  const valid = validTagIds instanceof Set ? validTagIds : new Set(validTagIds);
  const cited = extractCitedTags(answer);

  const unknown = cited.filter((t) => !valid.has(t));
  if (unknown.length > 0) {
    return {
      gate: 'citation_coverage',
      pass: false,
      detail: `References unknown evidence tags: ${unknown.join(', ')}`,
    };
  }

  if (
    evidenceCount > 0 &&
    answer.trim().length >= SUBSTANTIVE_MIN_CHARS &&
    cited.length === 0
  ) {
    return {
      gate: 'citation_coverage',
      pass: false,
      detail: `Substantive answer cites no evidence (${evidenceCount} sources available)`,
    };
  }

  return {
    gate: 'citation_coverage',
    pass: true,
    detail:
      cited.length > 0
        ? `Cites ${cited.length} evidence tag(s)`
        : 'Exempt (short reply or no evidence to cite)',
  };
}

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'github-token', re: /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'slack-token', re: /\bxox[abpr]-([A-Za-z0-9-]{10,})\b/ },
  { name: 'api-key-value', re: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?\S{8,}['"]?/i },
  { name: 'openai-key', re: /\bsk-(ant|proj|live)-[A-Za-z0-9-_]{10,}\b/ },
];

export function scanSecretsLeak(answer: string): GateResult {
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(answer)) {
      return {
        gate: 'secrets_leak',
        pass: false,
        detail: `Possible secret material detected (${name})`,
      };
    }
  }
  return { gate: 'secrets_leak', pass: true, detail: 'No secret patterns found' };
}

/** Run all pure gates. Slow model-judge gates run separately, post-hoc. */
export function runGuardrails(
  answer: string,
  opts: { validTagIds: ReadonlySet<string> | readonly string[]; evidenceCount: number },
): GuardrailVerdict {
  const results: GateResult[] = [
    checkCitationCoverage(answer, opts.validTagIds, opts.evidenceCount),
    scanSecretsLeak(answer),
  ];
  const pass = results.every((r) => r.pass);
  return {
    pass,
    blocked: !pass,
    results,
    citedTags: extractCitedTags(answer),
  };
}
