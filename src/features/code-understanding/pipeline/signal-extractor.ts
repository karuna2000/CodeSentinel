/**
 * Signal Extractor — extracts named architectural indicators from code.
 *
 * Each signal represents a meaningful architectural pattern whose presence
 * is relevant for downstream analysis agents (security, scalability, quality).
 *
 * Design:
 *  - Pure function, no side effects
 *  - Returns an array of ArchitecturalSignal objects with evidence strings
 *  - Each signal is only emitted once (deduplicated by name)
 *  - Scans the full content (not just a sample) for completeness
 */

import type { ArchitecturalSignal, ArchitecturalSignalName } from '@/types/code-understanding';

// ---------------------------------------------------------------------------
// Signal rule definitions
// ---------------------------------------------------------------------------

interface SignalRule {
  name: ArchitecturalSignalName;
  /** First matching pattern wins; the match is used as evidence string */
  patterns: Array<{
    regex: RegExp;
    evidence: string;
  }>;
}

const SIGNAL_RULES: SignalRule[] = [
  // Authentication
  {
    name: 'authentication',
    patterns: [
      { regex: /\b(jwt|jsonwebtoken|bcrypt|argon2|passport)\b/i, evidence: 'auth library (jwt/bcrypt/passport)' },
      { regex: /\b(signIn|signOut|getSession|getServerSession|useSession)\s*\(/, evidence: 'auth session function' },
      { regex: /\b(Authorization|Bearer|accessToken|refreshToken|authToken)\b/, evidence: 'auth token/header reference' },
      { regex: /from ['"]next-auth|from ['"]@auth\/|from ['"]passport/, evidence: 'auth library import' },
      { regex: /\b(login|logout|authenticate|verifyToken|hashPassword)\s*\(/, evidence: 'auth function call' },
    ],
  },

  // Database
  {
    name: 'database',
    patterns: [
      { regex: /from ['"]@prisma\/client['"]/, evidence: 'Prisma client import' },
      { regex: /from ['"]mongoose['"]|mongoose\.connect/, evidence: 'Mongoose import/connect' },
      { regex: /from ['"]pg['"]|from ['"]mysql2['"]|from ['"]sqlite3['"]/, evidence: 'raw DB driver import' },
      { regex: /\b(findMany|findFirst|findById|updateOne|deleteOne|insertOne)\s*\(/, evidence: 'database query method' },
      { regex: /\b(PrismaClient|MongoClient|Sequelize|TypeORM|Knex)\b/, evidence: 'ORM/DB client reference' },
      { regex: /\.(query|execute|transaction)\s*\(/, evidence: 'raw SQL query/execute call' },
    ],
  },

  // Caching
  {
    name: 'caching',
    patterns: [
      { regex: /from ['"]ioredis['"]|from ['"]redis['"]|require\(['"]redis['"]\)/, evidence: 'Redis client import' },
      { regex: /\b(redis|cache)\.(get|set|del|hget|hset|expire)\s*\(/, evidence: 'cache get/set operation' },
      { regex: /\bCache-Control\b|\bETag\b|no-cache|max-age=/, evidence: 'HTTP cache header' },
      { regex: /unstable_cache|revalidate:\s*\d+/, evidence: 'Next.js caching API' },
      { regex: /from ['"]node-cache['"]|from ['"]lru-cache['"]/, evidence: 'in-memory cache import' },
    ],
  },

  // Middleware usage
  {
    name: 'middleware',
    patterns: [
      { regex: /\(req\s*,\s*res\s*,\s*next\s*\)/, evidence: 'Express-style middleware (req,res,next)' },
      { regex: /NextResponse\.next\s*\(|NextResponse\.redirect\s*\(/, evidence: 'Next.js middleware response' },
      { regex: /app\.use\s*\(/, evidence: 'app.use() middleware registration' },
      { regex: /export\s+(default\s+)?function\s+middleware\s*\(/, evidence: 'middleware function export' },
    ],
  },

  // Async boundaries
  {
    name: 'async-boundary',
    patterns: [
      { regex: /\basync\s+function|\basync\s+\(/, evidence: 'async function declaration' },
      { regex: /\bawait\s+\w/, evidence: 'await expression' },
      { regex: /\.then\s*\(|\.catch\s*\(|\.finally\s*\(/, evidence: 'Promise chain' },
      { regex: /new Promise\s*\(/, evidence: 'explicit Promise construction' },
      { regex: /\bsetTimeout\b|\bsetInterval\b/, evidence: 'timer async boundary' },
    ],
  },

  // External API calls
  {
    name: 'api-call',
    patterns: [
      { regex: /\bfetch\s*\(['"]https?:\/\//, evidence: 'external fetch call' },
      { regex: /\baxios\.(get|post|put|delete|patch)\s*\(/, evidence: 'axios request' },
      { regex: /from ['"]axios['"]|require\(['"]axios['"]\)/, evidence: 'axios import' },
      { regex: /\bnew XMLHttpRequest\s*\(/, evidence: 'XMLHttpRequest usage' },
      { regex: /\bgot\.(get|post)|superagent\./, evidence: 'got/superagent HTTP client' },
    ],
  },

  // State management
  {
    name: 'state-management',
    patterns: [
      { regex: /\buseState\s*\(|useReducer\s*\(/, evidence: 'React local state' },
      { regex: /\bcreateSlice\s*\(|configureStore\s*\(/, evidence: 'Redux Toolkit store' },
      { regex: /\buseDispatch\s*\(\)|useSelector\s*\(/, evidence: 'Redux hooks' },
      { regex: /\batom\s*\(|useAtom\s*\(/, evidence: 'Jotai/Recoil atom' },
      { regex: /\bcreate\s*\(\s*\(\s*set\s*\)/, evidence: 'Zustand store' },
      { regex: /createContext\s*\(|useContext\s*\(/, evidence: 'React Context state' },
    ],
  },

  // Environment variables
  {
    name: 'env-variable',
    patterns: [
      { regex: /process\.env\.\w+/, evidence: 'process.env access' },
      { regex: /import\.meta\.env\.\w+/, evidence: 'import.meta.env (Vite) access' },
      { regex: /\benv\(\s*['"][A-Z_]+['"]\s*\)/, evidence: 'env() function call' },
      { regex: /process\.env\[['"][A-Z_]+['"]\]/, evidence: 'process.env bracket access' },
    ],
  },

  // WebSocket usage
  {
    name: 'websocket',
    patterns: [
      { regex: /new WebSocket\s*\(/, evidence: 'WebSocket constructor' },
      { regex: /\bSocket\.io\b|from ['"]socket\.io/, evidence: 'Socket.io import' },
      { regex: /\.on\s*\(\s*['"]connect['"]|\.on\s*\(\s*['"]message['"]/, evidence: 'WebSocket event listener' },
      { regex: /\bws\.send\s*\(|socket\.emit\s*\(/, evidence: 'WebSocket send/emit' },
    ],
  },

  // Filesystem access
  {
    name: 'filesystem-access',
    patterns: [
      { regex: /fs\.(readFile|writeFile|appendFile|unlink|mkdir|rmdir|stat)\s*\(/, evidence: 'fs read/write operation' },
      { regex: /from ['"]fs\/promises['"]|require\(['"]fs\/promises['"]\)/, evidence: 'fs/promises import' },
      { regex: /from ['"]fs['"]/, evidence: 'Node.js fs module import' },
      { regex: /path\.(join|resolve|dirname|basename)\s*\(/, evidence: 'path manipulation (fs hint)' },
    ],
  },

  // Error handling
  {
    name: 'error-handling',
    patterns: [
      { regex: /try\s*\{[\s\S]*?\}\s*catch\s*\(/, evidence: 'try/catch block' },
      { regex: /\.catch\s*\(\s*(err|error|e)\s*=>/, evidence: 'Promise .catch handler' },
      { regex: /\bErrorBoundary\b|\berrorBoundary\b/, evidence: 'React ErrorBoundary' },
      { regex: /throw\s+new\s+\w*Error\s*\(/, evidence: 'explicit error throw' },
    ],
  },

  // Logging
  {
    name: 'logging',
    patterns: [
      { regex: /console\.(log|error|warn|info|debug)\s*\(/, evidence: 'console logging' },
      { regex: /\blogger\.(info|warn|error|debug)\s*\(/, evidence: 'logger.xxx() call' },
      { regex: /from ['"]winston['"]|from ['"]pino['"]/, evidence: 'logging library import' },
    ],
  },

  // Rate limiting
  {
    name: 'rate-limiting',
    patterns: [
      { regex: /from ['"]express-rate-limit['"]|from ['"]@upstash\/ratelimit['"]/, evidence: 'rate limit library import' },
      { regex: /\brateLimit\s*\(|\bratelimit\s*\(/, evidence: 'rate limit function call' },
      { regex: /\bX-RateLimit\b|Retry-After/, evidence: 'rate limit HTTP headers' },
    ],
  },

  // CORS
  {
    name: 'cors',
    patterns: [
      { regex: /from ['"]cors['"]|require\(['"]cors['"]\)/, evidence: 'cors package import' },
      { regex: /Access-Control-Allow-Origin/, evidence: 'CORS response header' },
      { regex: /app\.use\s*\(\s*cors\s*\(/, evidence: 'cors middleware registration' },
    ],
  },

  // Encryption / Crypto
  {
    name: 'encryption',
    patterns: [
      { regex: /from ['"]crypto['"]|require\(['"]crypto['"]\)/, evidence: 'Node.js crypto module' },
      { regex: /\bcrypto\.(createHash|createCipher|randomBytes|createSign)\s*\(/, evidence: 'crypto operation' },
      { regex: /from ['"]bcrypt['"]|from ['"]argon2['"]/, evidence: 'password hashing library' },
      { regex: /\bAES\b|\bRSA\b|CryptoSubtle/, evidence: 'crypto algorithm reference' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts architectural signals from the full code content.
 *
 * @param content Full raw file content (not just sample — signals may appear anywhere)
 * @returns Array of unique ArchitecturalSignal objects ordered by rule definition order
 */
export function extractSignals(content: string): ArchitecturalSignal[] {
  const detected: ArchitecturalSignal[] = [];
  const seen = new Set<ArchitecturalSignalName>();

  for (const rule of SIGNAL_RULES) {
    if (seen.has(rule.name)) continue;

    for (const { regex, evidence } of rule.patterns) {
      if (regex.test(content)) {
        detected.push({ name: rule.name, evidence });
        seen.add(rule.name);
        break; // only emit each signal once
      }
    }
  }

  return detected;
}
