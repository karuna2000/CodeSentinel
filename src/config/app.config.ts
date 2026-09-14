export const API_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export const WIKI_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 3,
} as const;

export const INPUT_LIMITS = {
  chatMessageMaxChars: 4_000,
  chatHistoryMaxTurns: 16,
  queryMaxChars: 4_000,
  wikiAnswerMaxChars: 10_000,
} as const;