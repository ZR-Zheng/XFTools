type Variables = Record<string, number>;
const divide = (a: number, b: number) => {
  if (b === 0)
    throw new Error('The inputs do not determine a unique solution.');
  return a / b;
};
const root = (value: number) => {
  if (value < 0) throw new Error('These inputs have no real solution.');
  return Math.sqrt(value);
};
const solvers: Record<string, Record<string, (v: Variables) => number>> = {
  'ohms-law': {
    V: (v) => v.I * v.R,
    I: (v) => divide(v.V, v.R),
    R: (v) => divide(v.V, v.I)
  },
  'area-sphere': {
    A: (v) => 4 * Math.PI * v.r ** 2,
    r: (v) => root(v.A / (4 * Math.PI))
  },
  'volume-sphere': {
    v: (v) => (4 / 3) * Math.PI * v.r ** 3,
    r: (v) => Math.cbrt((3 * v.v) / (4 * Math.PI))
  },
  'cable-voltage-drop': {
    x: (v) => divide(2e6 * v.p * v.L * v.I, v.A),
    p: (v) => divide(v.x * v.A, 2e6 * v.L * v.I),
    L: (v) => divide(v.x * v.A, 2e6 * v.p * v.I),
    I: (v) => divide(v.x * v.A, 2e6 * v.p * v.L),
    A: (v) => divide(2e6 * v.p * v.L * v.I, v.x)
  },
  'slackline-tension': {
    T: (v) => divide(v.W * Math.hypot(v.S, v.L / 2), 2 * v.S),
    W: (v) => divide(2 * v.S * v.T, Math.hypot(v.S, v.L / 2)),
    L: (v) => 2 * v.S * root(divide(2 * v.T, v.W) ** 2 - 1),
    S: (v) => divide(v.W * v.L, 2 * root(4 * v.T ** 2 - v.W ** 2))
  }
};

/** Only the five published calculators are supported. No eval or expression runtime. */
export function solveCalculation(
  path: string,
  target: string,
  values: Variables
): number {
  const definition = solvers[path],
    solve = definition?.[target];
  if (!solve) throw new Error('Unsupported calculation.');
  for (const name of Object.keys(definition)) {
    if (name === target) continue;
    if (!Number.isFinite(values[name]))
      throw new Error('Enter a finite number for each input.');
    const nonNegative =
      path.includes('sphere') ||
      ['L', 'A', 'p', 'S', 'T', 'W', 'R'].includes(name);
    if (nonNegative && values[name] < 0)
      throw new Error(
        'Physical dimensions and material properties cannot be negative.'
      );
    if (
      ((path === 'slackline-tension' && ['S', 'T', 'W'].includes(name)) ||
        (path === 'cable-voltage-drop' && name === 'A')) &&
      values[name] === 0
    )
      throw new Error('This parameter must be greater than zero.');
  }
  const result = solve(values);
  if (!Number.isFinite(result))
    throw new Error('The result is outside the supported numeric range.');
  if (
    (path.includes('sphere') ||
      ['L', 'A', 'p', 'S', 'T', 'W', 'R'].includes(target)) &&
    result < 0
  )
    throw new Error('These inputs have no physical solution.');
  if (
    ((path === 'slackline-tension' && ['S', 'T', 'W'].includes(target)) ||
      (path === 'cable-voltage-drop' && target === 'A')) &&
    result === 0
  )
    throw new Error('These inputs have no physical solution.');
  return result;
}

export function cableOutputs(v: Variables) {
  const resistance = divide(2e6 * v.p * v.L, v.A);
  return { resistance, power: v.I ** 2 * resistance };
}
