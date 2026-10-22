import { describeDice } from './dice-format';

const dice = (sides: number, faces: number[], modifier = 0, multiplier = 1) => ({
  count: faces.length, sides, faces, modifier, multiplier,
  total: (faces.reduce((a, b) => a + b, 0) + modifier) * multiplier,
});

describe('describeDice', () => {
  it('one die', () => expect(describeDice(dice(6, [4]))).toBe('D6 → 4'));
  it('sums several dice', () => expect(describeDice(dice(6, [3, 4]))).toBe('2D6 → 3 + 4 = 7'));
  it('shows the multiplier', () => expect(describeDice(dice(6, [3, 4], 0, 10))).toBe('2D6 → 3 + 4 = 7 × 10 = 70'));
  it('multiplies a single die', () => expect(describeDice(dice(6, [4], 0, 5))).toBe('D6 → 4 × 5 = 20'));
  it('shows a modifier', () => expect(describeDice(dice(4, [3], -1))).toBe('D4-1 → 3 - 1 = 2'));
});
