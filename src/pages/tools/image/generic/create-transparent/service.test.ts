import { describe, it, expect } from 'vitest';
import { applyColorMask } from './service';
describe('transparent color mask', () => {
  it('makes matching pixels transparent and preserves unrelated alpha values', () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 0, 0, 120, 255, 255, 255, 0
    ]);
    applyColorMask(pixels, [255, 255, 255], 0);
    expect([...pixels]).toEqual([
      255, 255, 255, 0, 255, 0, 0, 120, 255, 255, 255, 0
    ]);
  });
  it('only replaces matching colors when background replacement is explicitly selected', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 255, 0, 0, 120]);
    applyColorMask(pixels, [255, 255, 255], 0, 'replace', [10, 20, 30]);
    expect([...pixels]).toEqual([10, 20, 30, 255, 255, 0, 0, 120]);
  });
});
