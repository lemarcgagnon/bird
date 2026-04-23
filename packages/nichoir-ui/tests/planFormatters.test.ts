import { describe, it, expect } from 'vitest';
import {
  formatPlanArea,
  formatPlanSize,
} from '../src/utils/planFormatters.js';

describe('formatPlanArea', () => {
  it('mm² → cm² avec toFixed(0) — divergence volontaire vs calcFormatters (port v15)', () => {
    // v15 src/main.js:172-173 : (totalArea / 100).toFixed(0) + ' cm²'
    expect(formatPlanArea(123456)).toBe('1235 cm²');
    expect(formatPlanArea(500)).toBe('5 cm²');
    expect(formatPlanArea(0)).toBe('0 cm²');
  });

  it('distinction nette vs calcFormatters.formatArea (toFixed(1))', () => {
    // Même input → sorties différentes entre plan (0 décimale) et calc (1 décimale)
    expect(formatPlanArea(12345)).toBe('123 cm²');
  });
});

describe('formatPlanSize', () => {
  it('format "W × H mm"', () => {
    expect(formatPlanSize(1220, 2440)).toBe('1220 × 2440 mm');
    expect(formatPlanSize(610, 1220)).toBe('610 × 1220 mm');
  });
});
