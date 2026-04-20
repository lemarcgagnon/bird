import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from '../src/components/primitives/Slider.js';

beforeEach(() => { cleanup(); });

/** Wrapper contrôlé minimal pour tester les flux de valeurs entrant/sortant. */
function Controlled({
  initial = 100,
  min = 0,
  max = 200,
  step = 1,
  dec = 0,
  allowOverflow = false,
  onChange,
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
  dec?: number;
  allowOverflow?: boolean;
  onChange?: (v: number) => void;
}): React.JSX.Element {
  const [v, setV] = useState(initial);
  return (
    <Slider
      label="W"
      value={v}
      onChange={(next): void => {
        setV(next);
        onChange?.(next);
      }}
      min={min}
      max={max}
      step={step}
      dec={dec}
      allowOverflow={allowOverflow}
    />
  );
}

describe('Slider (primitive)', () => {
  it('rend un range + number input avec aria-label label', () => {
    const { getAllByRole } = render(<Controlled />);
    const numInput = getAllByRole('spinbutton')[0]!;
    const range = getAllByRole('slider')[0]!;
    expect(numInput.getAttribute('aria-label')).toContain('W');
    expect(range.getAttribute('aria-label')).toBe('W');
  });

  it('drag du range → onChange immédiat', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled onChange={onChange} />);
    const range = getByRole('slider') as HTMLInputElement;
    fireEvent.change(range, { target: { value: '150' } });
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it('num input : pas de commit pendant la saisie (pattern draft)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled onChange={onChange} />);
    const num = getByRole('spinbutton') as HTMLInputElement;
    // Saisies intermédiaires
    fireEvent.change(num, { target: { value: '' } });
    fireEvent.change(num, { target: { value: '1' } });
    fireEvent.change(num, { target: { value: '12' } });
    // Aucun commit pendant la frappe
    expect(onChange).not.toHaveBeenCalled();
    // Draft visible dans l'input
    expect(num.value).toBe('12');
  });

  it('num input : commit sur blur avec clamp', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled min={0} max={200} onChange={onChange} />);
    const num = getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(num, { target: { value: '999' } });
    fireEvent.blur(num);
    expect(onChange).toHaveBeenCalledWith(200); // clamp à max
  });

  it('num input : commit sur Enter avec clamp', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled min={0} max={200} onChange={onChange} />);
    const num = getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(num, { target: { value: '-50' } });
    fireEvent.keyDown(num, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(0); // clamp à min
  });

  it('num input : Escape annule la saisie', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled initial={100} onChange={onChange} />);
    const num = getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(num, { target: { value: '150' } });
    fireEvent.keyDown(num, { key: 'Escape' });
    // Pas de commit, draft revient à la valeur initiale
    expect(onChange).not.toHaveBeenCalled();
    expect(num.value).toBe('100');
  });

  it('allowOverflow=true : num input accepte > max, range se fige au max', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Controlled min={0} max={200} allowOverflow onChange={onChange} />,
    );
    const num = getByRole('spinbutton') as HTMLInputElement;
    const range = getByRole('slider') as HTMLInputElement;
    fireEvent.change(num, { target: { value: '500' } });
    fireEvent.blur(num);
    // Commit = 500 (dépasse max, mais allowOverflow=true)
    expect(onChange).toHaveBeenCalledWith(500);
    // Range visuel clampé à 200
    expect(range.value).toBe('200');
    // Num input affiche la vraie valeur
    expect(num.value).toBe('500');
  });

  it('saisie invalide (texte) : garde la valeur courante après commit', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled initial={100} onChange={onChange} />);
    const num = getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(num, { target: { value: 'abc' } });
    fireEvent.blur(num);
    // parseFloat('abc') = NaN → garde 100
    // onChange est quand même appelé avec la valeur courante (pattern simple)
    expect(onChange).toHaveBeenCalledWith(100);
    expect(num.value).toBe('100');
  });
});
