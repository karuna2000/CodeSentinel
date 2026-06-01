import { SEVERITY_DEDUCTIONS, SCORE_GRADES } from '@/config/app.config';
import type { Finding } from '@/types/llm-reasoning';

export interface ScoreResult {
  score: number;
  grade: string;
  status: string;
}

export function computeScore(findings: Finding[], isReasoning: boolean): ScoreResult {
  if (findings.length === 0) {
    return {
      score: 100,
      grade: '—',
      status: isReasoning ? '⚡ Analyzing...' : 'Waiting for results',
    };
  }

  const totalDeduction = findings.reduce((acc, f) => {
    return acc + (SEVERITY_DEDUCTIONS[f.severity] ?? SEVERITY_DEDUCTIONS.low);
  }, 0);

  const score = Math.max(10, 100 - totalDeduction);

  const gradeEntry = SCORE_GRADES.find((g) => score >= g.min) ?? SCORE_GRADES[SCORE_GRADES.length - 1];

  return { score, grade: gradeEntry.grade, status: gradeEntry.status };
}
