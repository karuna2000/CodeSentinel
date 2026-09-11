import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    generationJob: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/features/wiki/services/module-summarizer', () => ({
  generateWikiPages: vi.fn(),
}));

vi.mock('@/features/wiki/services/mermaid-generator', () => ({
  generateFlowchart: vi.fn(),
}));

vi.mock('@/lib/llm/metering', () => ({
  recordUsage: vi.fn(),
  checkUsageBudget: vi.fn(),
}));

import { db } from '@/lib/db';
import { checkUsageBudget, recordUsage } from '@/lib/llm/metering';
import { generateWikiPages } from '@/features/wiki/services/module-summarizer';
import { generateFlowchart } from '@/features/wiki/services/mermaid-generator';
import { runWikiJob } from '../wiki-worker';

const mockJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  repo_id: 'repo-1',
  user_id: 'user-1',
  type: 'wiki',
  status: 'RUNNING',
  step: null,
  progress: 0,
  total: null,
  error: null,
  wiki_pages: null,
  diagram: null,
  created_at: new Date(),
  started_at: new Date(),
  completed_at: null,
  ...overrides,
});

function mockDbFindUnique() {
  (db.generationJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockJob());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runWikiJob budget gate', () => {
  it('fails the job without spending tokens when the daily cap is exhausted', async () => {
    mockDbFindUnique();
    (checkUsageBudget as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      usedTokens: 99_000,
      capTokens: 100_000,
      remainingTokens: 1_000,
    });

    await runWikiJob('job-1');

    expect(generateWikiPages).not.toHaveBeenCalled();
    expect(generateFlowchart).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
    expect(db.generationJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: expect.stringContaining('Daily AI usage cap reached'),
        step: 'Usage cap reached',
      }),
    });
  });

  it('runs generation when the budget allows', async () => {
    mockDbFindUnique();
    (checkUsageBudget as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      usedTokens: 1_000,
      capTokens: 100_000,
      remainingTokens: 99_000,
    });
    (generateWikiPages as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (generateFlowchart as ReturnType<typeof vi.fn>).mockResolvedValue('flowchart LR');
    (db.generationJob.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockJob());

    await runWikiJob('job-1');

    expect(generateWikiPages).toHaveBeenCalled();
    expect(generateFlowchart).toHaveBeenCalled();
    expect(db.generationJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'SUCCEEDED', wiki_pages: 3, diagram: true }),
    });
  });
});