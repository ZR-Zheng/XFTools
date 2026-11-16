import { describe, it, expect } from 'vitest';
import { getResizeDimensions } from './resize-dimensions';
import type { InitialValuesType } from './types';
const base: InitialValuesType = {
  resizeMethod: 'pixels',
  dimensionType: 'width',
  width: '400',
  height: '200',
  percentage: '50',
  maintainAspectRatio: true
};
describe('resize dimensions shown before processing', () => {
  it('uses the edited dimension as anchor and preserves each image ratio', () => {
    expect(getResizeDimensions(160, 120, base)).toEqual({
      width: 400,
      height: 300
    });
    expect(getResizeDimensions(120, 160, base)).toEqual({
      width: 400,
      height: 533
    });
    expect(
      getResizeDimensions(160, 120, { ...base, dimensionType: 'height' })
    ).toEqual({ width: 267, height: 200 });
  });
  it('supports stretching and percent scaling with a minimum pixel', () => {
    expect(
      getResizeDimensions(160, 120, { ...base, maintainAspectRatio: false })
    ).toEqual({ width: 400, height: 200 });
    expect(
      getResizeDimensions(160, 120, { ...base, resizeMethod: 'percentage' })
    ).toEqual({ width: 80, height: 60 });
    expect(
      getResizeDimensions(1, 1, {
        ...base,
        resizeMethod: 'percentage',
        percentage: '1'
      })
    ).toEqual({ width: 1, height: 1 });
  });
});
