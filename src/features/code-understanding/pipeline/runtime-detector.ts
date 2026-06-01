

import type { RuntimeDetection } from '@/types/code-understanding';

interface RuntimeRule {
  type: string;
  baseConfidence: number;
  confidencePerExtraSignal: number;
  maxConfidence: number;
  patterns: Array<{ regex: RegExp; label: string }>;
}

const RUNTIME_RULES: RuntimeRule[] = [
  
  {
    type: 'edge',
    baseConfidence: 0.78,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.97,
    patterns: [
      { regex: /export\s+const\s+runtime\s*=\s*['"]edge['"]/, label: 'edge runtime declaration' },
      { regex: /\bEdgeRuntime\b/, label: 'EdgeRuntime global' },
      { regex: /from ['"]@cloudflare\/workers-types['"]/, label: 'Cloudflare Workers types' },
      { regex: /addEventListener\s*\(\s*['"]fetch['"]/, label: 'Cloudflare fetch listener' },
      { regex: /\bExecutionContext\b|\benv:\s*Env\b/, label: 'Cloudflare Worker context' },
    ],
  },

  
  {
    type: 'serverless',
    baseConfidence: 0.75,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.95,
    patterns: [
      { regex: /exports\.handler\s*=|module\.exports\.handler\s*=/, label: 'Lambda handler export' },
      { regex: /\bAWSLambda\b|\bAPIGatewayProxyEvent\b|\bAPIGatewayProxyResult\b/, label: 'AWS Lambda types' },
      { regex: /from ['"]@aws-sdk\//, label: 'AWS SDK import' },
      { regex: /context\.awsRequestId|event\.Records/, label: 'Lambda event/context usage' },
      { regex: /\bVercelRequest\b|\bVercelResponse\b/, label: 'Vercel serverless types' },
    ],
  },

  // CLI
  {
    type: 'cli',
    baseConfidence: 0.74,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.94,
    patterns: [
      { regex: /process\.argv\b/, label: 'process.argv' },
      { regex: /from ['"]readline['"]|require\(['"]readline['"]\)/, label: 'readline import' },
      { regex: /from ['"]commander['"]|from ['"]yargs['"]/, label: 'CLI framework import' },
      { regex: /process\.stdin|process\.stdout|process\.stderr/, label: 'process stdio' },
      { regex: /\bconsole\.log\s*\(|console\.error\s*\(/, label: 'console output (CLI pattern)' },
    ],
  },

  
  {
    type: 'browser',
    baseConfidence: 0.72,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.96,
    patterns: [
      { regex: /\bwindow\s*\.\w+|\bdocument\s*\.\w+/, label: 'window/document access' },
      { regex: /\blocalStorage\s*\.\w+|\bsessionStorage\s*\.\w+/, label: 'localStorage/sessionStorage' },
      { regex: /\bnavigator\s*\.\w+/, label: 'navigator API' },
      { regex: /\baddEventListener\s*\(/, label: 'addEventListener (DOM)' },
      { regex: /\blocation\s*\.(href|pathname|search|hash)\b/, label: 'window.location' },
      { regex: /\bfetch\s*\(|XMLHttpRequest/, label: 'fetch/XHR (browser common)' },
      { regex: /['"]use client['"]/, label: 'use client directive' },
    ],
  },

  // Node.js
  {
    type: 'node',
    baseConfidence: 0.70,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.95,
    patterns: [
      { regex: /from ['"]fs['"]|require\(['"]fs['"]\)/, label: 'fs import' },
      { regex: /from ['"]path['"]|require\(['"]path['"]\)/, label: 'path import' },
      { regex: /from ['"]child_process['"]|require\(['"]child_process['"]\)/, label: 'child_process import' },
      { regex: /from ['"]os['"]|require\(['"]os['"]\)/, label: 'os import' },
      { regex: /from ['"]crypto['"]|require\(['"]crypto['"]\)/, label: 'crypto import' },
      { regex: /from ['"]stream['"]|require\(['"]stream['"]\)/, label: 'stream import' },
      { regex: /from ['"]http['"]|from ['"]https['"]/, label: 'http/https module' },
      { regex: /process\.env\.\w+/, label: 'process.env access' },
      { regex: /require\s*\(\s*['"]/, label: 'CommonJS require' },
      { regex: /__dirname|__filename/, label: '__dirname / __filename' },
    ],
  },

  // Middleware (Express/Koa/Next.js middleware pattern)
  {
    type: 'middleware',
    baseConfidence: 0.65,
    confidencePerExtraSignal: 0.08,
    maxConfidence: 0.90,
    patterns: [
      { regex: /\(req\s*,\s*res\s*,\s*next\s*\)/, label: 'Express middleware signature (req,res,next)' },
      { regex: /\bNextResponse\.next\s*\(/, label: 'NextResponse.next() middleware call' },
      { regex: /export\s+(default\s+)?function\s+middleware\s*\(/, label: 'Next.js middleware export' },
      { regex: /export\s+const\s+config\s*=\s*\{\s*matcher/, label: 'Next.js middleware matcher config' },
      { regex: /\basync\s+function\s+middleware\s*\(/, label: 'async middleware function' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Infers the execution environment of the code artifact.
 *
 * @param content  Raw file content
 * @param filename Optional filename for convention-based hints
 * @returns RuntimeDetection with type, confidence, and signal evidence,
 *          or null if the runtime cannot be determined with reasonable confidence.
 */
export function detectRuntime(content: string, filename?: string): RuntimeDetection | null {
  const sample = content.slice(0, 3000);

  let bestMatch: RuntimeDetection | null = null;

  for (const rule of RUNTIME_RULES) {
    const matched: string[] = [];

    for (const { regex, label } of rule.patterns) {
      if (regex.test(sample)) {
        matched.push(label);
      }
    }

    if (matched.length === 0) continue;

    const confidence = Math.min(
      rule.maxConfidence,
      rule.baseConfidence + (matched.length - 1) * rule.confidencePerExtraSignal,
    );

    const boosted = applyFilenameBias(confidence, rule.type, filename);
    const finalConfidence = Math.min(rule.maxConfidence, boosted);

    if (!bestMatch || finalConfidence > bestMatch.confidence) {
      bestMatch = {
        type: rule.type,
        confidence: finalConfidence,
        signals: matched,
      };
    }
  }

  // Only return a result if confidence is above a meaningful threshold
  if (!bestMatch || bestMatch.confidence < 0.50) return null;

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFilenameBias(
  confidence: number,
  runtimeType: string,
  filename?: string,
): number {
  if (!filename) return confidence;
  const lower = filename.toLowerCase();

  if (runtimeType === 'middleware' && lower.includes('middleware')) {
    return Math.min(0.95, confidence + 0.10);
  }
  if (runtimeType === 'node' && lower.endsWith('.cjs')) {
    return Math.min(0.95, confidence + 0.05);
  }
  if (runtimeType === 'serverless' && (lower.includes('lambda') || lower.includes('handler'))) {
    return Math.min(0.95, confidence + 0.08);
  }

  return confidence;
}
