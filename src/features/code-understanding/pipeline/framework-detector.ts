import type { FrameworkDetection } from '@/types/code-understanding';

interface FrameworkRule {
  name: string;
  confidencePerSignal: number;
  baseConfidence: number;
  maxConfidence: number;
  patterns: Array<{
    regex: RegExp;
    label: string;
  }>;
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  {
    name: 'Next.js',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]next\//, label: 'next/* import' },
      { regex: /['"]use client['"]|['"]use server['"]/, label: '"use client"/"use server" directive' },
      { regex: /export\s+(default\s+)?async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/, label: 'App Router route handler' },
      { regex: /export\s+const\s+metadata\s*=/, label: 'Next.js metadata export' },
      { regex: /NextRequest|NextResponse/, label: 'NextRequest/NextResponse types' },
      { regex: /generateStaticParams\s*\(/, label: 'generateStaticParams()' },
      { regex: /getServerSideProps|getStaticProps|getStaticPaths/, label: 'Pages Router data fetcher' },
    ],
  },
  {
    name: 'React',
    baseConfidence: 0.60,
    confidencePerSignal: 0.07,
    maxConfidence: 0.95,
    patterns: [
      { regex: /from ['"]react['"]/, label: 'react import' },
      { regex: /\buseState\s*\(|\buseEffect\s*\(|\buseCallback\s*\(|\buseMemo\s*\(/, label: 'React hooks' },
      { regex: /React\.createElement\s*\(|<[A-Z][A-Za-z]+/, label: 'JSX/React.createElement' },
      { regex: /\bReact\.memo\s*\(|React\.forwardRef\s*\(/, label: 'React.memo/forwardRef' },
    ],
  },
  {
    name: 'Express',
    baseConfidence: 0.65,
    confidencePerSignal: 0.08,
    maxConfidence: 0.95,
    patterns: [
      { regex: /require\s*\(\s*['"]express['"]\s*\)|from ['"]express['"]/, label: 'express import' },
      { regex: /\bRouter\s*\(\s*\)/, label: 'express Router()' },
      { regex: /app\.(get|post|put|delete|use)\s*\(/, label: 'app.METHOD() route' },
      { regex: /\bexpress\s*\(\s*\)/, label: 'express() app init' },
    ],
  },
  {
    name: 'NestJS',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]@nestjs\/core['"]|from ['"]@nestjs\/common['"]/, label: '@nestjs import' },
      { regex: /@Controller\s*\(|@Injectable\s*\(/, label: '@Controller/@Injectable decorator' },
      { regex: /@Module\s*\(/, label: '@Module decorator' },
      { regex: /InjectRepository\s*\(/, label: 'InjectRepository()' },
    ],
  },
  {
    name: 'Prisma',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from ['"]@prisma\/client['"]/, label: '@prisma/client import' },
      { regex: /new PrismaClient\s*\(/, label: 'new PrismaClient()' },
      { regex: /prisma\.\w+\.(findMany|findFirst|create|update|upsert|delete)\s*\(/, label: 'Prisma query method' },
      { regex: /prisma\.\$transaction\s*\(/, label: 'prisma.$transaction()' },
    ],
  },
  {
    name: 'Vue',
    baseConfidence: 0.65,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /\bdefineComponent\s*\(|\bsetup\s*\(/, label: 'Vue Composition API' },
      { regex: /from ['"]vue['"]/, label: 'vue import' },
      { regex: /<script\s+setup/, label: '<script setup>' },
      { regex: /\bref\s*\(|\breactive\s*\(|\bcomputed\s*\(/, label: 'Vue reactivity primitives' },
    ],
  },
  {
    name: 'FastAPI',
    baseConfidence: 0.70,
    confidencePerSignal: 0.08,
    maxConfidence: 0.97,
    patterns: [
      { regex: /from fastapi import FastAPI|import fastapi/, label: 'fastapi import' },
      { regex: /@app\.(get|post|put|delete|patch)\s*\(/, label: 'FastAPI route decorator' },
      { regex: /\bDepends\s*\(/, label: 'FastAPI Depends()' },
    ],
  },
];

export function detectFramework(content: string, filename?: string): FrameworkDetection | null {
  const sample = content.slice(0, 3000);

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

function applyFilenameBias(
  confidence: number,
  framework: string,
  filename?: string,
): number {
  if (!filename) return confidence;
  const lower = filename.toLowerCase();

  if (
    framework === 'Next.js' &&
    (lower === 'page.tsx' || lower === 'page.ts' || lower === 'route.ts' || lower === 'layout.tsx')
  ) {
    return Math.min(0.97, confidence + 0.10);
  }

  return confidence;
}
