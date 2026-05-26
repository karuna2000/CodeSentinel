/**
 * Framework Detector — infers the frontend/backend framework ecosystem.
 *
 * Strategy:
 *  - Scan import paths for known package names
 *  - Check API patterns and naming conventions
 *  - Support confidence scoring (multiple signals = higher confidence)
 *
 * Design:
 *  - Pure function, no side effects, no LLM calls
 *  - Returns null when no framework signals are found
 *  - Returns FrameworkDetection with evidence signals for transparency
 */

import type { FrameworkDetection } from '@/types/code-understanding';

// ---------------------------------------------------------------------------
// Framework rules
// ---------------------------------------------------------------------------

interface FrameworkRule {
  name: string;
  /** Each matched signal adds `confidencePerSignal` to total */
  confidencePerSignal: number;
  /** Base confidence when ANY pattern matches */
  baseConfidence: number;
  /** Max confidence cap */
  maxConfidence: number;
  patterns: Array<{
    regex: RegExp;
    label: string;
  }>;
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  // ─── Frontend ────────────────────────────────────────────────────────────

  // Next.js (check before React — it implies React)
  {
    name: 'Next.js',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]next\//, label: 'next/* import' },
      { regex: /from ['"]next-auth/, label: 'next-auth import' },
      { regex: /export\s+(default\s+)?function\s+(Page|Layout|Loading|Error|NotFound)\b/, label: 'App Router page export' },
      { regex: /export\s+const\s+metadata\s*=/, label: 'Next.js metadata export' },
      { regex: /export\s+const\s+runtime\s*=\s*['"]edge['"]/, label: 'edge runtime declaration' },
      { regex: /export\s+(default\s+)?async\s+function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/, label: 'App Router route handler' },
      { regex: /getServerSideProps|getStaticProps|getStaticPaths/, label: 'Pages Router data fetcher' },
      { regex: /from ['"]@\//, label: '@/ path alias (Next.js convention)' },
      { regex: /['"]use client['"]|['"]use server['"]/, label: 'Next.js directive' },
      { regex: /NextResponse|NextRequest/, label: 'Next.js response/request' },
    ],
  },

  // React
  {
    name: 'React',
    baseConfidence: 0.68,
    confidencePerSignal: 0.07,
    maxConfidence: 0.95,
    patterns: [
      { regex: /from ['"]react['"]/, label: 'react import' },
      { regex: /from ['"]react-dom['"]/, label: 'react-dom import' },
      { regex: /from ['"]react-router/, label: 'react-router import' },
      { regex: /\bReact\.(createElement|Fragment|useEffect|useState|useRef|memo)\b/, label: 'React API usage' },
      { regex: /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer)\s*\(/, label: 'React hooks' },
      { regex: /<[A-Z][a-zA-Z]*[\s/>]/, label: 'JSX component usage' },
      { regex: /return\s*\(\s*</, label: 'JSX return' },
    ],
  },

  // Vue
  {
    name: 'Vue',
    baseConfidence: 0.72,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from ['"]vue['"]/, label: 'vue import' },
      { regex: /from ['"]@vue\//, label: '@vue/* import' },
      { regex: /<template>|<script setup|defineComponent\(/, label: 'Vue SFC / Options API' },
      { regex: /\b(ref\(|reactive\(|computed\(|watch\(|onMounted\()\b/, label: 'Vue Composition API' },
      { regex: /from ['"]vue-router['"]|from ['"]pinia['"]/, label: 'Vue Router / Pinia' },
    ],
  },

  // Angular
  {
    name: 'Angular',
    baseConfidence: 0.72,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from ['"]@angular\//, label: '@angular/* import' },
      { regex: /@(Component|Injectable|NgModule|Directive|Pipe|Input|Output)\s*\(/, label: 'Angular decorator' },
      { regex: /implements\s+(OnInit|OnDestroy|OnChanges)\b/, label: 'Angular lifecycle interface' },
      { regex: /\bHttpClient\b|\bActivatedRoute\b/, label: 'Angular DI service' },
    ],
  },

  // Svelte
  {
    name: 'Svelte',
    baseConfidence: 0.78,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]svelte['"]|from ['"]svelte\//, label: 'svelte import' },
      { regex: /<script\s+lang=["']ts["']>|<style>/, label: 'Svelte component structure' },
      { regex: /\$:\s+/, label: 'Svelte reactive statement' },
    ],
  },

  // ─── Backend ─────────────────────────────────────────────────────────────

  // NestJS (check before Express — more specific)
  {
    name: 'NestJS',
    baseConfidence: 0.74,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]@nestjs\//, label: '@nestjs/* import' },
      { regex: /@(Controller|Injectable|Module|Get|Post|Put|Delete|Guard|Interceptor|Pipe)\s*\(/, label: 'NestJS decorator' },
      { regex: /\bInjectRepository\b|\bTypeOrmModule\b/, label: 'NestJS TypeORM' },
    ],
  },

  // Express
  {
    name: 'Express',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.95,
    patterns: [
      { regex: /from ['"]express['"]|require\(['"]express['"]\)/, label: 'express import' },
      { regex: /\b(app|router)\.(get|post|put|delete|use|listen)\s*\(/, label: 'Express route/app methods' },
      { regex: /Router\s*\(\)|express\s*\(\)/, label: 'Express factory' },
      { regex: /req\s*,\s*res\s*,\s*next/, label: 'Express middleware signature' },
    ],
  },

  // Fastify
  {
    name: 'Fastify',
    baseConfidence: 0.74,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from ['"]fastify['"]|require\(['"]fastify['"]\)/, label: 'fastify import' },
      { regex: /fastify\.(get|post|put|delete|register|addHook)\s*\(/, label: 'Fastify route/plugin' },
      { regex: /\bFastifyRequest\b|\bFastifyReply\b/, label: 'Fastify types' },
    ],
  },

  // Hono
  {
    name: 'Hono',
    baseConfidence: 0.80,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]hono['"]|from ['"]hono\//, label: 'hono import' },
      { regex: /new Hono\s*\(|app\.fire\s*\(/, label: 'Hono app factory' },
    ],
  },

  // Koa
  {
    name: 'Koa',
    baseConfidence: 0.74,
    confidencePerSignal: 0.08,
    maxConfidence: 0.95,
    patterns: [
      { regex: /from ['"]koa['"]|require\(['"]koa['"]\)/, label: 'koa import' },
      { regex: /ctx\.(body|status|request|response)\s*[=.]/, label: 'Koa context usage' },
    ],
  },

  // ─── Python ──────────────────────────────────────────────────────────────

  // FastAPI
  {
    name: 'FastAPI',
    baseConfidence: 0.78,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from\s+fastapi\s+import|import\s+fastapi/, label: 'fastapi import' },
      { regex: /@app\.(get|post|put|delete|patch)\s*\(/, label: 'FastAPI route decorator' },
      { regex: /\bFastAPI\s*\(\)|APIRouter\s*\(\)/, label: 'FastAPI/APIRouter factory' },
    ],
  },

  // Django
  {
    name: 'Django',
    baseConfidence: 0.76,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from\s+django\.|import\s+django/, label: 'django import' },
      { regex: /from\s+django\.db\s+import\s+models/, label: 'Django models import' },
      { regex: /\bdjango\.urls\b|\burlpatterns\b/, label: 'Django URL routing' },
      { regex: /\bHttpResponse\b|\brender\s*\(request/, label: 'Django view patterns' },
    ],
  },

  // Flask
  {
    name: 'Flask',
    baseConfidence: 0.76,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from\s+flask\s+import|import\s+flask/, label: 'flask import' },
      { regex: /@app\.route\s*\(/, label: 'Flask route decorator' },
      { regex: /\bFlask\s*\(__name__\)|jsonify\s*\(/, label: 'Flask factory/jsonify' },
    ],
  },

  // ─── ORMs & Data ─────────────────────────────────────────────────────────

  // Prisma
  {
    name: 'Prisma',
    baseConfidence: 0.80,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]@prisma\/client['"]/, label: '@prisma/client import' },
      { regex: /new PrismaClient\s*\(/, label: 'PrismaClient instantiation' },
      { regex: /prisma\.\w+\.(findMany|findFirst|create|update|delete|upsert)\s*\(/, label: 'Prisma query' },
    ],
  },

  // Mongoose
  {
    name: 'Mongoose',
    baseConfidence: 0.78,
    confidencePerSignal: 0.08,
    maxConfidence: 0.96,
    patterns: [
      { regex: /from ['"]mongoose['"]|require\(['"]mongoose['"]\)/, label: 'mongoose import' },
      { regex: /new Schema\s*\(|mongoose\.model\s*\(/, label: 'Mongoose Schema/Model' },
    ],
  },

  // tRPC
  {
    name: 'tRPC',
    baseConfidence: 0.82,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]@trpc\//, label: '@trpc/* import' },
      { regex: /\bcreateTRPCRouter\b|\bpublicProcedure\b|\bprotectedProcedure\b/, label: 'tRPC procedure/router' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects the framework/ecosystem used in the code artifact.
 *
 * @param content  Raw file content
 * @param filename Optional filename for convention-based hints
 * @returns FrameworkDetection with name, confidence, and matched signals,
 *          or null when no framework patterns are found.
 */
export function detectFramework(content: string, filename?: string): FrameworkDetection | null {
  const sample = content.slice(0, 3000); // broader window for imports

  let bestMatch: FrameworkDetection | null = null;

  for (const rule of FRAMEWORK_RULES) {
    const matchedSignals: string[] = [];

    for (const { regex, label } of rule.patterns) {
      if (regex.test(sample)) {
        matchedSignals.push(label);
      }
    }

    if (matchedSignals.length === 0) continue;

    const confidence = Math.min(
      rule.maxConfidence,
      rule.baseConfidence + (matchedSignals.length - 1) * rule.confidencePerSignal,
    );

    // Filename-convention boosts
    const boostedConfidence = applyFilenameBias(confidence, rule.name, filename);

    if (!bestMatch || boostedConfidence > bestMatch.confidence) {
      bestMatch = {
        name: rule.name,
        confidence: Math.min(rule.maxConfidence, boostedConfidence),
        signals: matchedSignals,
      };
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFilenameBias(
  confidence: number,
  framework: string,
  filename?: string,
): number {
  if (!filename) return confidence;
  const lower = filename.toLowerCase();

  // Next.js App Router conventions
  if (
    framework === 'Next.js' &&
    (lower === 'page.tsx' || lower === 'page.ts' || lower === 'route.ts' || lower === 'layout.tsx')
  ) {
    return Math.min(0.97, confidence + 0.10);
  }

  return confidence;
}
