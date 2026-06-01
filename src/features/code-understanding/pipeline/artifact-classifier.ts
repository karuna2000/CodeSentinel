

import type { ArtifactTypeDetection } from '@/types/code-understanding';

interface ClassifierRule {
  type: string;
  baseConfidence: number;
  confidencePerExtraSignal: number;
  maxConfidence: number;
  
  filenamePatterns?: RegExp[];
  
  patterns: Array<{ regex: RegExp; label: string }>;
}

const CLASSIFIER_RULES: ClassifierRule[] = [
  
  {
    type: 'test-file',
    baseConfidence: 0.82,
    confidencePerExtraSignal: 0.05,
    maxConfidence: 0.98,
    filenamePatterns: [/\.(test|spec)\.[tj]sx?$/, /__tests__/],
    patterns: [
      { regex: /\b(describe|it|test|beforeEach|afterEach|beforeAll|afterAll)\s*\(/, label: 'test block' },
      { regex: /\b(expect|assert|should)\s*\(/, label: 'assertion' },
      { regex: /from ['"]vitest['"]|from ['"]jest['"]|from ['"]@testing-library\//, label: 'test framework import' },
      { regex: /\bvi\.fn\(\)|jest\.fn\(\)|jest\.mock\(|vi\.mock\(/, label: 'mock/spy usage' },
    ],
  },

  // React component
  {
    type: 'react-component',
    baseConfidence: 0.72,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.96,
    filenamePatterns: [/[A-Z][a-zA-Z]*\.(tsx|jsx)$/],
    patterns: [
      { regex: /export\s+(default\s+)?function\s+[A-Z][a-zA-Z]*\s*\(/, label: 'PascalCase component export' },
      { regex: /return\s*\(\s*</, label: 'JSX return' },
      { regex: /React\.FC|React\.ReactNode|JSX\.Element/, label: 'React type annotation' },
      { regex: /\b(useState|useEffect|useRef|useCallback|useMemo)\s*\(/, label: 'React hooks usage' },
      { regex: /props\s*:\s*\{|interface\s+\w+Props\s*\{/, label: 'Props interface/type' },
      { regex: /<[A-Z][a-zA-Z]*[\s/>]/, label: 'Component JSX usage' },
    ],
  },

  // React Hook
  {
    type: 'hook',
    baseConfidence: 0.76,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.97,
    filenamePatterns: [/^use[A-Z].*\.[tj]sx?$/],
    patterns: [
      { regex: /export\s+(default\s+)?function\s+use[A-Z][a-zA-Z]*\s*\(/, label: 'useXxx export' },
      { regex: /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext)\s*\(/, label: 'React hooks composition' },
      { regex: /return\s*\{[^}]*\}/, label: 'Returns object from hook' },
    ],
  },

  // Context Provider
  {
    type: 'context-provider',
    baseConfidence: 0.78,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.96,
    filenamePatterns: [/context\.[tj]sx?$|provider\.[tj]sx?$/i],
    patterns: [
      { regex: /createContext\s*\(/, label: 'createContext call' },
      { regex: /\bProvider\b.*\bvalue\s*=\s*\{/, label: 'Provider value prop' },
      { regex: /export\s+const\s+use[A-Z]\w+Context\s*=/, label: 'useXxxContext hook export' },
      { regex: /\bContextType\b|\bReact\.createContext\b/, label: 'React Context API' },
    ],
  },

  // API Route handler
  {
    type: 'api-route',
    baseConfidence: 0.74,
    confidencePerExtraSignal: 0.08,
    maxConfidence: 0.97,
    filenamePatterns: [/route\.[tj]s$|route\.tsx$|api\//],
    patterns: [
      { regex: /export\s+(default\s+)?async\s+function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/, label: 'HTTP method export (App Router)' },
      { regex: /export\s+(default\s+)?function\s+handler\s*\(/, label: 'Pages Router handler export' },
      { regex: /\bNextRequest\b|\bNextResponse\b/, label: 'Next.js request/response' },
      { regex: /\bRequest\b.*\bResponse\b|\bResponse\.json\s*\(/, label: 'Web standard Request/Response' },
      { regex: /res\.(json|send|status)\s*\(/, label: 'Express-style response methods' },
    ],
  },

  // Middleware
  {
    type: 'middleware',
    baseConfidence: 0.76,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.96,
    filenamePatterns: [/middleware\.[tj]sx?$/i],
    patterns: [
      { regex: /export\s+(default\s+)?function\s+middleware\s*\(/, label: 'middleware function export' },
      { regex: /NextResponse\.next\s*\(|NextResponse\.redirect\s*\(/, label: 'NextResponse middleware methods' },
      { regex: /\(req\s*,\s*res\s*,\s*next\s*\)/, label: 'Express middleware signature' },
      { regex: /export\s+const\s+config\s*=\s*\{\s*matcher/, label: 'Next.js matcher config' },
    ],
  },

  // Auth module
  {
    type: 'auth-module',
    baseConfidence: 0.72,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.95,
    filenamePatterns: [/auth\.[tj]sx?$|session\.[tj]sx?$|jwt\.[tj]sx?$/i],
    patterns: [
      { regex: /\b(jwt|jsonwebtoken|bcrypt|argon2|passport)\b/, label: 'auth library usage' },
      { regex: /\b(signIn|signOut|getSession|useSession|authenticate)\s*\(/, label: 'auth function calls' },
      { regex: /\b(accessToken|refreshToken|bearerToken|authToken)\b/, label: 'auth token references' },
      { regex: /from ['"]next-auth|from ['"]@auth\//, label: 'auth library import' },
      { regex: /\bAuthOptions\b|\bNextAuth\s*\(/, label: 'NextAuth config' },
    ],
  },

  // Schema / Model type definition (filename-specific patterns are more precise)
  {
    type: 'schema-model',
    baseConfidence: 0.68,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.93,
    filenamePatterns: [
      /\.schema\.[tj]sx?$/i,
      /\.model\.[tj]sx?$/i,
      /\b(types?|interfaces?|dto)\.[tj]sx?$/i,
    ],
    patterns: [
      { regex: /\bz\.(object|string|number|array|enum|union)\s*\(/, label: 'Zod schema definition' },
      { regex: /\btype\s+\w+\s*=\s*\{/, label: 'TypeScript type definition' },
      { regex: /\binterface\s+\w+\s*\{/, label: 'TypeScript interface' },
      { regex: /\benum\s+\w+\s*\{/, label: 'Enum definition' },
      { regex: /export\s+type\s+\w+|export\s+interface\s+\w+/, label: 'exported type/interface' },
    ],
  },

  // Database layer
  {
    type: 'database-layer',
    baseConfidence: 0.72,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.95,
    filenamePatterns: [/\b(db|database|repository|repo)\.[tj]s$/i],
    patterns: [
      { regex: /from ['"]@prisma\/client['"]/, label: 'Prisma client import' },
      { regex: /from ['"]mongoose['"]|mongoose\.model/, label: 'Mongoose usage' },
      { regex: /\b(findMany|findFirst|findById|create|updateOne|deleteOne)\s*\(/, label: 'DB query methods' },
      { regex: /\bPrismaClient\b|\bMongoose\b|\bSequelize\b|\bTypeORM\b/, label: 'ORM class reference' },
      { regex: /new Schema\s*\(\{/, label: 'Schema constructor' },
    ],
  },

  // Store (state management)
  {
    type: 'store',
    baseConfidence: 0.74,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.95,
    filenamePatterns: [/\b(store|slice|atom|reducer)\.[tj]sx?$/i],
    patterns: [
      { regex: /\bcreateSlice\s*\(|createStore\s*\(/, label: 'Redux slice/store creation' },
      { regex: /\batom\s*\(|selector\s*\(/, label: 'Recoil/Jotai atom/selector' },
      { regex: /\bcreate\s*\(\s*\(\s*set\s*\)/, label: 'Zustand store pattern' },
      { regex: /\buseDispatch\b|\buseSelector\b/, label: 'Redux hooks' },
    ],
  },

  // Service / Business logic
  {
    type: 'service',
    baseConfidence: 0.60,
    confidencePerExtraSignal: 0.07,
    maxConfidence: 0.88,
    filenamePatterns: [/\.service\.[tj]sx?$|service\.[tj]sx?$/i],
    patterns: [
      { regex: /@Injectable\s*\(\)/, label: 'NestJS Injectable decorator' },
      { regex: /export\s+(default\s+)?class\s+\w+Service\b/, label: 'Service class export' },
      { regex: /\bRepositoryPort\b|\bRepository<\w+>/, label: 'Repository injection' },
    ],
  },

  // Config / Config file
  {
    type: 'config',
    baseConfidence: 0.70,
    confidencePerExtraSignal: 0.05,
    maxConfidence: 0.93,
    filenamePatterns: [
      /\.(config|rc)\.[tj]sx?$|\.(yaml|yml|json|toml|env)$/i,
      /^(next|tailwind|eslint|vite|jest|vitest|tsconfig|babel|webpack)\./,
    ],
    patterns: [
      { regex: /module\.exports\s*=\s*\{|export\s+default\s*\{/, label: 'config object export' },
      { regex: /defineConfig\s*\(|withNextConfig\s*\(/, label: 'defineConfig wrapper' },
      { regex: /^[A-Z_]+\s*=\s*.+$/m, label: 'environment variable pattern' },
    ],
  },

  // Utility / Helper
  {
    type: 'utility',
    baseConfidence: 0.55,
    confidencePerExtraSignal: 0.06,
    maxConfidence: 0.85,
    filenamePatterns: [/\b(util|utils|helper|helpers|lib|shared)\.[tj]sx?$/i],
    patterns: [
      { regex: /export\s+(const|function)\s+\w+/, label: 'named utility exports' },
      { regex: /export\s*\{[^}]+\}/, label: 'barrel re-exports' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies what architectural role the file likely plays.
 *
 * @param content  Raw file content
 * @param filename Optional filename for convention-based classification
 * @returns ArtifactTypeDetection with type and confidence, or null when
 *          no classification reaches a meaningful threshold.
 */
export function classifyArtifact(
  content: string,
  filename?: string,
): ArtifactTypeDetection | null {
  const sample = content.slice(0, 3000);
  let bestMatch: { type: string; confidence: number } | null = null;

  for (const rule of CLASSIFIER_RULES) {
    let confidence = 0;

    // Filename pattern bonus
    if (filename && rule.filenamePatterns) {
      for (const fp of rule.filenamePatterns) {
        if (fp.test(filename)) {
          confidence = Math.max(confidence, rule.baseConfidence + 0.10);
          break;
        }
      }
    }

    // Content pattern scoring
    const matched: string[] = [];
    for (const { regex } of rule.patterns) {
      if (regex.test(sample)) matched.push(regex.source);
    }

    if (matched.length > 0) {
      const fromContent = Math.min(
        rule.maxConfidence,
        rule.baseConfidence + (matched.length - 1) * rule.confidencePerExtraSignal,
      );
      confidence = Math.max(confidence, fromContent);
    }

    if (confidence === 0) continue;

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { type: rule.type, confidence };
    }
  }

  if (!bestMatch || bestMatch.confidence < 0.52) return null;

  return {
    type: bestMatch.type,
    confidence: Math.min(0.98, bestMatch.confidence),
  };
}
