import { describe, expect, it } from 'vitest';
import { cableOutputs, solveCalculation } from './solver';
import Qty from 'js-quantities';

describe('explicit calculator formulas', () => {
  const fixtures: [string, Record<string, number>][] = [
    ['ohms-law', { V: 12, I: 2, R: 6 }],
    ['area-sphere', { A: 4 * Math.PI * 25, r: 5 }],
    ['volume-sphere', { v: (4 / 3) * Math.PI * 125, r: 5 }],
    ['cable-voltage-drop', { p: 1.68e-8, L: 10, A: 2.5, I: 4, x: 0.5376 }],
    ['slackline-tension', { L: 2, W: 1, S: 0.05, T: Math.hypot(0.05, 1) / 0.1 }]
  ];
  for (const [path, values] of fixtures) {
    for (const [target, expected] of Object.entries(values))
      it(`${path} solves ${target} in both directions`, () => {
        const inputs = { ...values };
        delete inputs[target];
        expect(solveCalculation(path, target, inputs)).toBeCloseTo(expected, 9);
      });
  }
  it('handles zero, nonfinite, impossible and underdetermined inputs explicitly', () => {
    expect(solveCalculation('volume-sphere', 'r', { v: 0 })).toBe(0);
    expect(() => solveCalculation('ohms-law', 'R', { V: 0, I: 0 })).toThrow(
      'unique'
    );
    expect(() =>
      solveCalculation('ohms-law', 'V', { I: Infinity, R: 1 })
    ).toThrow('finite');
    expect(() => solveCalculation('volume-sphere', 'v', { r: -1 })).toThrow(
      'negative'
    );
    expect(() =>
      solveCalculation('slackline-tension', 'L', { W: 10, T: 1, S: 0.1 })
    ).toThrow('real');
    expect(() =>
      solveCalculation('cable-voltage-drop', 'x', { p: 1, L: 1, I: 1, A: 0 })
    ).toThrow('zero');
    expect(() => solveCalculation('unknown', 'x', {})).toThrow('Unsupported');
  });
  it('preserves units for material presets and exposes consistent derived outputs', () => {
    expect(Qty(16.8, 'nohm*m').to('ohm*m').scalar).toBeCloseTo(1.68e-8, 15);
    expect(Qty(1, 'pound-force').to('N').scalar).toBeCloseTo(4.44822161526, 5);
    const extras = cableOutputs({ p: 1.68e-8, L: 10, A: 2.5, I: 4 });
    expect(extras.resistance).toBeCloseTo(0.1344);
    expect(extras.power).toBeCloseTo(2.1504);
  });
});
