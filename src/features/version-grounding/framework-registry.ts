

import type { ApiPatternMatch, GroundingSource } from '@/types/version-grounding';

function primaryDoc(label: string, url: string, purpose: string): GroundingSource {
  return { label, url, priority: 1, purpose };
}

function secondaryDoc(label: string, url: string, purpose: string): GroundingSource {
  return { label, url, priority: 2, purpose };
}

function supplementaryDoc(label: string, url: string, purpose: string): GroundingSource {
  return { label, url, priority: 3, purpose };
}

export interface FrameworkCapabilityEntry {
  
  name: string;
  

  versionBrackets: VersionBracket[];
  

  apiPatterns: ApiPatternMatch[];
  

  defaultGroundingSources: GroundingSource[];
}

export interface VersionBracket {
  
  label: string;
  minVersion: string;
  maxVersion: string | null;
  
  confidenceBoost: number;
  
  indicators: RegExp[];
  
  groundingSources: GroundingSource[];
}

export const REACT_ENTRY: FrameworkCapabilityEntry = {
  name: 'React',
  versionBrackets: [
    {
      label: 'React 19.x',
      minVersion: '19.0',
      maxVersion: null,
      confidenceBoost: 0.10,
      indicators: [
        /\buse\s*\(|useOptimistic\s*\(|useFormStatus\s*\(/,
        /from ['"]react['"].*\buse\b/,
        /React\.use\s*\(/,
      ],
      groundingSources: [
        primaryDoc('React 19 Release Blog', 'https://react.dev/blog/2024/12/05/react-19', 'React 19 new APIs and breaking changes'),
        primaryDoc('React 19 Upgrade Guide', 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide', 'Migration from React 18 to 19'),
        secondaryDoc('React 19 Canary Changelog', 'https://react.dev/blog/2024/02/15/react-labs-what-we-have-been-working-on-february-2024', 'Experimental features in React 19'),
      ],
    },
    {
      label: 'React 18.x',
      minVersion: '18.0',
      maxVersion: '18.x',
      confidenceBoost: 0.12,
      indicators: [
        /\buseTransition\s*\(|\bstartTransition\s*\(/,
        /\buseId\s*\(|\buseDeferredValue\s*\(|\buseInsertionEffect\s*\(/,
        /\bcreateRoot\s*\(|hydrateRoot\s*\(/,
        /\bSuspense\b.*\bfallback/,
        /\bconcurrent/i,
      ],
      groundingSources: [
        primaryDoc('React 18 Release Blog', 'https://react.dev/blog/2022/03/29/react-v18', 'React 18 concurrent features'),
        primaryDoc('React 18 APIs Reference', 'https://react.dev/reference/react', 'All React 18 hooks and APIs'),
        secondaryDoc('Upgrading to React 18', 'https://react.dev/blog/2022/03/08/react-18-upgrade-guide', 'Migration guide'),
        supplementaryDoc('React Concurrent Mode', 'https://react.dev/blog/2021/06/08/the-plan-for-react-18', 'Concurrent rendering plan'),
      ],
    },
    {
      label: 'React 16–17.x',
      minVersion: '16.8',
      maxVersion: '17.x',
      confidenceBoost: 0.05,
      indicators: [
        /\buseState\s*\(|\buseEffect\s*\(|\buseCallback\s*\(|\buseMemo\s*\(/,
        /React\.createContext\s*\(/,
        /React\.memo\s*\(/,
      ],
      groundingSources: [
        primaryDoc('React Hooks Reference', 'https://react.dev/reference/react', 'Core hooks introduced in React 16.8'),
        secondaryDoc('Hooks FAQ', 'https://react.dev/learn/reusing-logic-with-custom-hooks', 'Custom hooks patterns'),
      ],
    },
  ],
  apiPatterns: [
    { api: 'useTransition()', framework: 'React', introducedInVersion: '18.0', description: 'Marks state updates as non-urgent (concurrent rendering)', deprecatedInVersion: null },
    { api: 'startTransition()', framework: 'React', introducedInVersion: '18.0', description: 'Wraps updates that can be interrupted by urgent renders', deprecatedInVersion: null },
    { api: 'useId()', framework: 'React', introducedInVersion: '18.0', description: 'Generates stable IDs for accessibility (SSR-safe)', deprecatedInVersion: null },
    { api: 'useDeferredValue()', framework: 'React', introducedInVersion: '18.0', description: 'Defers re-rendering of non-critical UI', deprecatedInVersion: null },
    { api: 'useInsertionEffect()', framework: 'React', introducedInVersion: '18.0', description: 'Fires before DOM mutations (CSS-in-JS use case)', deprecatedInVersion: null },
    { api: 'createRoot()', framework: 'React', introducedInVersion: '18.0', description: 'Replaces ReactDOM.render() for concurrent mode', deprecatedInVersion: null },
    { api: 'use()', framework: 'React', introducedInVersion: '19.0', description: 'Reads resources (Promises, Context) during render', deprecatedInVersion: null },
    { api: 'useOptimistic()', framework: 'React', introducedInVersion: '19.0', description: 'Optimistic UI updates for async actions', deprecatedInVersion: null },
    { api: 'ReactDOM.render()', framework: 'React', introducedInVersion: '16.0', description: 'Legacy render API', deprecatedInVersion: '18.0' },
  ],
  defaultGroundingSources: [
    primaryDoc('React Documentation', 'https://react.dev', 'Official React reference and guides'),
    primaryDoc('React Changelog', 'https://github.com/facebook/react/blob/main/CHANGELOG.md', 'Full React release history'),
  ],
};

// ---------------------------------------------------------------------------
// Next.js
// ---------------------------------------------------------------------------

export const NEXTJS_ENTRY: FrameworkCapabilityEntry = {
  name: 'Next.js',
  versionBrackets: [
    {
      label: 'Next.js 15.x',
      minVersion: '15.0',
      maxVersion: null,
      confidenceBoost: 0.10,
      indicators: [
        /\buse\s+cache\b|'use cache'/,
        /cacheLife\s*\(|cacheTag\s*\(/,
        /after\s*\(/,
        /connection\s*\(\s*\)/,
      ],
      groundingSources: [
        primaryDoc('Next.js 15 Release Notes', 'https://nextjs.org/blog/next-15', 'Next.js 15 new features'),
        primaryDoc('Next.js 15 Docs', 'https://nextjs.org/docs', 'Official Next.js 15 documentation'),
        secondaryDoc('Next.js 15 Migration Guide', 'https://nextjs.org/docs/app/building-your-application/upgrading/version-15', 'Upgrading to Next.js 15'),
      ],
    },
    {
      label: 'Next.js 13–14.x (App Router)',
      minVersion: '13.0',
      maxVersion: '14.x',
      confidenceBoost: 0.12,
      indicators: [
        /['"']use client['"']|['"']use server['"']/,
        /export\s+(default\s+)?async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/,
        /export\s+const\s+metadata\s*=/,
        /NextRequest|NextResponse/,
        /from ['"]next\/server['"]/,
        /generateStaticParams\s*\(/,
        /\bnotFound\s*\(\)|\bredirect\s*\(/,
      ],
      groundingSources: [
        primaryDoc('Next.js App Router Docs', 'https://nextjs.org/docs/app', 'App Router overview and reference'),
        primaryDoc('Server Components', 'https://nextjs.org/docs/app/building-your-application/rendering/server-components', 'React Server Components in Next.js'),
        secondaryDoc('Next.js 13 Migration', 'https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration', 'Pages → App Router migration'),
        secondaryDoc('Next.js Caching', 'https://nextjs.org/docs/app/building-your-application/caching', 'Caching behaviour in App Router'),
      ],
    },
    {
      label: 'Next.js 12.x (Pages Router)',
      minVersion: '12.0',
      maxVersion: '12.x',
      confidenceBoost: 0.08,
      indicators: [
        /getServerSideProps|getStaticProps|getStaticPaths/,
        /from ['"]next\/router['"]/,
        /from ['"]next\/link['"]/,
        /from ['"]next\/image['"]/,
      ],
      groundingSources: [
        primaryDoc('Next.js Pages Router Docs', 'https://nextjs.org/docs/pages', 'Pages Router reference'),
        primaryDoc('Data Fetching (Pages)', 'https://nextjs.org/docs/pages/building-your-application/data-fetching', 'getServerSideProps / getStaticProps'),
        secondaryDoc('Next.js 12 Changelog', 'https://nextjs.org/blog/next-12', 'Next.js 12 features'),
      ],
    },
  ],
  apiPatterns: [
    { api: '"use client"', framework: 'Next.js', introducedInVersion: '13.0', description: 'Marks component tree as client-side (App Router)', deprecatedInVersion: null },
    { api: '"use server"', framework: 'Next.js', introducedInVersion: '13.0', description: 'Marks functions as Server Actions (App Router)', deprecatedInVersion: null },
    { api: 'generateStaticParams()', framework: 'Next.js', introducedInVersion: '13.0', description: 'Static param generation (App Router equivalent of getStaticPaths)', deprecatedInVersion: null },
    { api: 'export const metadata', framework: 'Next.js', introducedInVersion: '13.2', description: 'Metadata API for SEO (App Router)', deprecatedInVersion: null },
    { api: 'export const runtime = "edge"', framework: 'Next.js', introducedInVersion: '12.2', description: 'Enables Edge Runtime for route/middleware', deprecatedInVersion: null },
    { api: 'getServerSideProps()', framework: 'Next.js', introducedInVersion: '9.3', description: 'Server-side rendering data fetcher (Pages Router)', deprecatedInVersion: null },
    { api: '"use cache"', framework: 'Next.js', introducedInVersion: '15.0', description: 'Next.js 15 fine-grained caching directive', deprecatedInVersion: null },
  ],
  defaultGroundingSources: [
    primaryDoc('Next.js Documentation', 'https://nextjs.org/docs', 'Official Next.js docs'),
    primaryDoc('Next.js Changelog', 'https://github.com/vercel/next.js/blob/canary/packages/next/CHANGELOG.md', 'Full Next.js release history'),
  ],
};

export const EXPRESS_ENTRY: FrameworkCapabilityEntry = {
  name: 'Express',
  versionBrackets: [
    {
      label: 'Express 5.x',
      minVersion: '5.0',
      maxVersion: null,
      confidenceBoost: 0.10,
      indicators: [
        /\bapp\.listen\s*\(.*\bawait\b/,
        /express\s*\(\s*\).*\bPromise\b/,
      ],
      groundingSources: [
        primaryDoc('Express 5 Migration Guide', 'https://expressjs.com/en/guide/migrating-5.html', 'Migrating from Express 4 to 5'),
        primaryDoc('Express 5 API Reference', 'https://expressjs.com/en/5x/api.html', 'Express 5 full API'),
      ],
    },
    {
      label: 'Express 4.x',
      minVersion: '4.0',
      maxVersion: '4.x',
      confidenceBoost: 0.08,
      indicators: [
        /require\s*\(\s*['"]express['"]\s*\)/,
        /\bRouter\s*\(\s*\)/,
        /app\.(get|post|put|delete|use)\s*\(/,
      ],
      groundingSources: [
        primaryDoc('Express 4 API Reference', 'https://expressjs.com/en/4x/api.html', 'Express 4 full API'),
        primaryDoc('Express Routing Guide', 'https://expressjs.com/en/guide/routing.html', 'Routing in Express'),
        secondaryDoc('Express Security Best Practices', 'https://expressjs.com/en/advanced/best-practice-security.html', 'Security guidance for Express apps'),
      ],
    },
  ],
  apiPatterns: [
    { api: 'express.Router()', framework: 'Express', introducedInVersion: '4.0', description: 'Modular route handler', deprecatedInVersion: null },
    { api: 'express.json()', framework: 'Express', introducedInVersion: '4.16', description: 'Built-in JSON body parser (replaces body-parser)', deprecatedInVersion: null },
    { api: 'app.listen()', framework: 'Express', introducedInVersion: '4.0', description: 'Start HTTP server', deprecatedInVersion: null },
  ],
  defaultGroundingSources: [
    primaryDoc('Express.js Documentation', 'https://expressjs.com/en/api.html', 'Express API reference'),
    secondaryDoc('Express Security Advisories', 'https://expressjs.com/en/advanced/best-practice-security.html', 'Security best practices'),
  ],
};

// ---------------------------------------------------------------------------
// Prisma
// ---------------------------------------------------------------------------

export const PRISMA_ENTRY: FrameworkCapabilityEntry = {
  name: 'Prisma',
  versionBrackets: [
    {
      label: 'Prisma 5.x',
      minVersion: '5.0',
      maxVersion: null,
      confidenceBoost: 0.10,
      indicators: [
        /prisma\.\$transaction\s*\(\s*\[/,
        /\bPrismaClientKnownRequestError\b/,
        /\btypedSql\b|\b\$extends\b/,
        /relationLoadStrategy/,
      ],
      groundingSources: [
        primaryDoc('Prisma 5 Changelog', 'https://www.prisma.io/blog/prisma-5-0-0-release', 'Prisma 5 breaking changes and features'),
        primaryDoc('Prisma Client API', 'https://www.prisma.io/docs/orm/reference/prisma-client-reference', 'Prisma Client full API reference'),
        secondaryDoc('Prisma Upgrade Guide (4→5)', 'https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-5', 'Migration from Prisma 4'),
      ],
    },
    {
      label: 'Prisma 4.x',
      minVersion: '4.0',
      maxVersion: '4.x',
      confidenceBoost: 0.07,
      indicators: [
        /new PrismaClient\s*\(/,
        /prisma\.\w+\.(findMany|findFirst|create|update|upsert|delete)\s*\(/,
      ],
      groundingSources: [
        primaryDoc('Prisma Client API', 'https://www.prisma.io/docs/orm/reference/prisma-client-reference', 'Prisma Client full API reference'),
        primaryDoc('Prisma Schema Reference', 'https://www.prisma.io/docs/orm/reference/prisma-schema-reference', 'Prisma schema language reference'),
        secondaryDoc('Prisma Security', 'https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting', 'Safe querying with Prisma'),
      ],
    },
  ],
  apiPatterns: [
    { api: 'prisma.$extends()', framework: 'Prisma', introducedInVersion: '4.7', description: 'Client extensions for query customisation', deprecatedInVersion: null },
    { api: 'prisma.$transaction([])', framework: 'Prisma', introducedInVersion: '4.0', description: 'Sequential batch transactions', deprecatedInVersion: null },
    { api: 'prisma.findUniqueOrThrow()', framework: 'Prisma', introducedInVersion: '4.0', description: 'Throws instead of returning null', deprecatedInVersion: null },
    { api: 'typedSql', framework: 'Prisma', introducedInVersion: '5.19', description: 'Type-safe raw SQL queries', deprecatedInVersion: null },
  ],
  defaultGroundingSources: [
    primaryDoc('Prisma Documentation', 'https://www.prisma.io/docs', 'Official Prisma ORM documentation'),
    primaryDoc('Prisma Changelog', 'https://github.com/prisma/prisma/releases', 'Prisma release history'),
  ],
};

// ---------------------------------------------------------------------------
// Vue
// ---------------------------------------------------------------------------

export const VUE_ENTRY: FrameworkCapabilityEntry = {
  name: 'Vue',
  versionBrackets: [
    {
      label: 'Vue 3.x (Composition API)',
      minVersion: '3.0',
      maxVersion: null,
      confidenceBoost: 0.12,
      indicators: [
        /\bdefineComponent\s*\(|\bsetup\s*\(/,
        /\bref\s*\(|\breactive\s*\(|\bcomputed\s*\(|\bwatch\s*\(/,
        /from ['"]vue['"].*\b(ref|reactive|computed|onMounted)\b/,
        /<script\s+setup/,
      ],
      groundingSources: [
        primaryDoc('Vue 3 Documentation', 'https://vuejs.org/guide/introduction.html', 'Official Vue 3 guide'),
        secondaryDoc('Vue 3 Migration from Vue 2', 'https://v3-migration.vuejs.org/', 'Breaking changes from Vue 2'),
      ],
    },
    {
      label: 'Vue 2.x (Options API)',
      minVersion: '2.0',
      maxVersion: '2.x',
      confidenceBoost: 0.07,
      indicators: [
        /\bVue\.extend\s*\(|\bnew Vue\s*\(/,
        /\bdata\s*\(\s*\)\s*\{[\s\S]*?\breturn\s*\{/,
        /\bmounted\s*\(\s*\)\s*\{/,
      ],
      groundingSources: [
        primaryDoc('Vue 2 Documentation', 'https://v2.vuejs.org', 'Vue 2 official docs (note: EOL)'),
        secondaryDoc('Vue 2 EOL Notice', 'https://v2.vuejs.org/eol', 'Vue 2 end-of-life information'),
      ],
    },
  ],
  apiPatterns: [
    { api: 'defineComponent()', framework: 'Vue', introducedInVersion: '3.0', description: 'Type-safe component definition (Composition API)', deprecatedInVersion: null },
    { api: '<script setup>', framework: 'Vue', introducedInVersion: '3.2', description: 'Compile-time syntactic sugar for Composition API', deprecatedInVersion: null },
    { api: 'ref()', framework: 'Vue', introducedInVersion: '3.0', description: 'Reactive reference primitive', deprecatedInVersion: null },
    { api: 'new Vue()', framework: 'Vue', introducedInVersion: '2.0', description: 'Legacy Vue 2 Options API constructor', deprecatedInVersion: '3.0' },
  ],
  defaultGroundingSources: [
    primaryDoc('Vue.js Documentation', 'https://vuejs.org', 'Official Vue 3 documentation'),
    primaryDoc('Vue Changelog', 'https://github.com/vuejs/core/blob/main/CHANGELOG.md', 'Vue 3 release history'),
  ],
};

export const NESTJS_ENTRY: FrameworkCapabilityEntry = {
  name: 'NestJS',
  versionBrackets: [
    {
      label: 'NestJS 10.x',
      minVersion: '10.0',
      maxVersion: null,
      confidenceBoost: 0.08,
      indicators: [
        /from ['"]@nestjs\/core['"]|from ['"]@nestjs\/common['"]/,
        /@Controller\s*\(|@Injectable\s*\(/,
        /\bINJECT_MODULE\b|\bModuleRef\b/,
      ],
      groundingSources: [
        primaryDoc('NestJS Documentation', 'https://docs.nestjs.com', 'Official NestJS reference'),
        secondaryDoc('NestJS Security', 'https://docs.nestjs.com/security/authentication', 'Auth and security in NestJS'),
      ],
    },
  ],
  apiPatterns: [
    { api: '@Injectable()', framework: 'NestJS', introducedInVersion: '1.0', description: 'Marks class as NestJS injectable provider', deprecatedInVersion: null },
    { api: '@Controller()', framework: 'NestJS', introducedInVersion: '1.0', description: 'Route handler class decorator', deprecatedInVersion: null },
    { api: '@Module()', framework: 'NestJS', introducedInVersion: '1.0', description: 'Defines a NestJS module', deprecatedInVersion: null },
    { api: 'InjectRepository()', framework: 'NestJS', introducedInVersion: '6.0', description: 'TypeORM repository injection', deprecatedInVersion: null },
  ],
  defaultGroundingSources: [
    primaryDoc('NestJS Documentation', 'https://docs.nestjs.com', 'Official NestJS reference'),
    primaryDoc('NestJS Changelog', 'https://github.com/nestjs/nest/releases', 'NestJS release history'),
  ],
};

export const FASTAPI_ENTRY: FrameworkCapabilityEntry = {
  name: 'FastAPI',
  versionBrackets: [
    {
      label: 'FastAPI 0.100+',
      minVersion: '0.100',
      maxVersion: null,
      confidenceBoost: 0.08,
      indicators: [
        /from fastapi import FastAPI|import fastapi/,
        /@app\.(get|post|put|delete|patch)\s*\(/,
        /\bAnnotated\[|\bDepends\s*\(/,
      ],
      groundingSources: [
        primaryDoc('FastAPI Documentation', 'https://fastapi.tiangolo.com', 'Official FastAPI docs'),
        primaryDoc('FastAPI Changelog', 'https://fastapi.tiangolo.com/release-notes/', 'FastAPI release notes'),
        secondaryDoc('FastAPI Security', 'https://fastapi.tiangolo.com/tutorial/security/', 'Security patterns in FastAPI'),
      ],
    },
  ],
  apiPatterns: [
    { api: 'Annotated[type, Depends()]', framework: 'FastAPI', introducedInVersion: '0.95', description: 'PEP 593 annotated dependency injection', deprecatedInVersion: null },
    { api: '@app.get() / @app.post()', framework: 'FastAPI', introducedInVersion: '0.1', description: 'Route decorator with automatic OpenAPI generation', deprecatedInVersion: null },
    { api: 'APIRouter()', framework: 'FastAPI', introducedInVersion: '0.42', description: 'Modular route grouping', deprecatedInVersion: null },
  ],
  defaultGroundingSources: [
    primaryDoc('FastAPI Documentation', 'https://fastapi.tiangolo.com', 'Official FastAPI docs'),
  ],
};

export const FRAMEWORK_REGISTRY: Record<string, FrameworkCapabilityEntry> = {
  'React': REACT_ENTRY,
  'Next.js': NEXTJS_ENTRY,
  'Express': EXPRESS_ENTRY,
  'Prisma': PRISMA_ENTRY,
  'Vue': VUE_ENTRY,
  'NestJS': NESTJS_ENTRY,
  'FastAPI': FASTAPI_ENTRY,
};

export function getFrameworkEntry(name: string): FrameworkCapabilityEntry | undefined {
  return FRAMEWORK_REGISTRY[name];
}

export function getAllApiPatterns(): ApiPatternMatch[] {
  return Object.values(FRAMEWORK_REGISTRY).flatMap((e) =>
    e.apiPatterns,
  );
}
