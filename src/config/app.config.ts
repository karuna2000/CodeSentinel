export const SEVERITY_DEDUCTIONS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export const SCORE_GRADES: Array<{ min: number; grade: string; status: string }> = [
  { min: 95, grade: 'A',  status: '✅ Looks great' },
  { min: 90, grade: 'A-', status: '✅ Looks clean' },
  { min: 80, grade: 'B+', status: '⚠️ Review recommended' },
  { min: 70, grade: 'B',  status: '⚠️ Not production-ready' },
  { min: 50, grade: 'C',  status: '🚨 Needs refactoring' },
  { min: 0,  grade: 'D',  status: '🚨 Critical vulnerabilities' },
];

export const API_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
} as const;

export const FEATURE_FLAGS = {
  exportPdf: false,
} as const;
