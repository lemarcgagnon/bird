import { describe, it, expect } from 'vitest';
import {
  formatUsagePct,
  formatPlanArea,
  formatPlanSize,
} from '../src/utils/planFormatters.js';

describe('formatUsagePct', () => {
  it('ratio totalArea / (shW × shH) × 100, 1 décimale', () => {
    // shW=1220, shH=2440 → panelArea=2976800 mm² ≈ 29768 cm²
    // totalArea=1000000 mm² → usage = 1000000/2976800 * 100 ≈ 33.6%
    expect(formatUsagePct(1000000, 1220, 2440)).toBe('33.6%');
  });

  it('usage 100% exact', () => {
    expect(formatUsagePct(2976800, 1220, 2440)).toBe('100.0%');
  });

  it('usage 0 sur totalArea=0', () => {
    expect(formatUsagePct(0, 1220, 2440)).toBe('0.0%');
  });

  it('defensif : panelArea ≤ 0 → "0.0%" au lieu de NaN/Infinity', () => {
    expect(formatUsagePct(100, 0, 2440)).toBe('0.0%');
    expect(formatUsagePct(100, 1220, 0)).toBe('0.0%');
    expect(formatUsagePct(100, -10, 10)).toBe('0.0%');
  });
});

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
