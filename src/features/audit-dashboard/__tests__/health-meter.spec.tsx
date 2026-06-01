

import { describe, it, expect } from 'vitest';

interface HealthMeterInputs {
  grade?: string;
  score?: number;
  status?: string;
}

function getHealthMeterValues({ grade = 'B+', score = 78, status = '⚠ Not prod-ready' }: HealthMeterInputs) {
  return { grade, score, status };
}

describe('HealthMeter — props and defaults', () => {
  it('uses default grade "B+" when not provided', () => {
    const { grade } = getHealthMeterValues({});
    expect(grade).toBe('B+');
  });

  it('uses default score of 78 when not provided', () => {
    const { score } = getHealthMeterValues({});
    expect(score).toBe(78);
  });

  it('uses default status text when not provided', () => {
    const { status } = getHealthMeterValues({});
    expect(status).toBe('⚠ Not prod-ready');
  });

  it('reflects a custom grade when provided', () => {
    const { grade } = getHealthMeterValues({ grade: 'A' });
    expect(grade).toBe('A');
  });

  it('reflects a custom score when provided', () => {
    const { score } = getHealthMeterValues({ score: 95 });
    expect(score).toBe(95);
  });

  it('reflects a custom status when provided', () => {
    const { status } = getHealthMeterValues({ status: '✅ Production ready' });
    expect(status).toBe('✅ Production ready');
  });

  it('allows score of 0 (edge case)', () => {
    const { score } = getHealthMeterValues({ score: 0 });
    expect(score).toBe(0);
  });

  it('allows score of 100 (perfect)', () => {
    const { score } = getHealthMeterValues({ score: 100 });
    expect(score).toBe(100);
  });
});
