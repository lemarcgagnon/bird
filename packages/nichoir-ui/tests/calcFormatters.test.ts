import { describe, it, expect } from 'vitest';
import {
  formatVolume,
  formatArea,
  formatThickness,
} from '../src/utils/calcFormatters.js';

describe('formatVolume', () => {
  it('v ≤ 1e6 → cm³ avec 1 décimale (division par 1e3)', () => {
    expect(formatVolume(500000)).toBe('500.0 cm³');
    expect(formatVolume(12345)).toBe('12.3 cm³');
    expect(formatVolume(0)).toBe('0.0 cm³');
  });

  it('v === 1e6 → encore cm³ (seuil strict > 1e6, port v15)', () => {
    expect(formatVolume(1e6)).toBe('1000.0 cm³');
  });

  it('v > 1e6 → L avec 2 décimales (division par 1e6)', () => {
    expect(formatVolume(1e6 + 1)).toBe('1.00 L');
    expect(formatVolume(2e6)).toBe('2.00 L');
    expect(formatVolume(1.234e7)).toBe('12.34 L');
  });
});

describe('formatArea', () => {
  it('mm² → cm² avec 1 décimale (division par 100)', () => {
    expect(formatArea(500)).toBe('5.0 cm²');
    expect(formatArea(12345)).toBe('123.5 cm²');
    expect(formatArea(0)).toBe('0.0 cm²');
  });
});

describe('formatThickness', () => {
  it('format dual mm + inch (25.4 mm = 1 inch)', () => {
    expect(formatThickness(25.4)).toBe('25.4 mm (1.00")');
    expect(formatThickness(12)).toBe('12.0 mm (0.47")');
    expect(formatThickness(3)).toBe('3.0 mm (0.12")');
  });

  it('arrondi toFixed(2) pour inch', () => {
    // 10 mm = 0.3937... inch → "0.39"
    expect(formatThickness(10)).toBe('10.0 mm (0.39")');
  });
});
