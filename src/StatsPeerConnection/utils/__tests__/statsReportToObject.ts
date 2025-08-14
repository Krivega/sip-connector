import statsReportToObject from '../statsReportToObject';

describe('statsReportToObject', () => {
  it('#1 returns empty object for empty map', () => {
    const input = new Map<string, { type: string }>();

    const result = statsReportToObject(input);

    expect(result).toEqual({});
  });

  it('#2 maps entries by their type', () => {
    const audio = { type: 'audio' } as const;
    const video = { type: 'video' } as const;

    const input = new Map<string, { type: string }>([
      ['a', audio],
      ['v', video],
    ]);

    const result = statsReportToObject(input);

    expect(result).toEqual({ audio, video });
  });

  it('#3 last item with the same type overrides previous', () => {
    const first = { type: 'dup' } as const;
    const second = { type: 'dup' } as const;

    const input = new Map<string, { type: string }>([
      ['1', first],
      ['2', second],
    ]);

    const result = statsReportToObject(input) as Record<string, unknown>;

    expect(result.dup).toBe(second);
  });

  it('#4 skips keys with undefined value (returns accumulator without changes)', () => {
    const audio = { type: 'audio' } as const;

    const input = new Map<string, { type: string }>([
      ['u', undefined as unknown as { type: string }],
      ['a', audio],
    ]);

    const result = statsReportToObject(input);

    expect(result).toEqual({ audio });
  });
});
