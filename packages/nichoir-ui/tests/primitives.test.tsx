import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Tabs } from '../src/components/primitives/Tabs.js';
import { ToggleBar } from '../src/components/primitives/ToggleBar.js';
import { Checkbox } from '../src/components/primitives/Checkbox.js';

beforeEach(() => { cleanup(); });

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

describe('Tabs (primitive)', () => {
  const items = [
    { value: 'a', label: 'A', panelId: 'p-a' },
    { value: 'b', label: 'B', panelId: 'p-b' },
    { value: 'c', label: 'C', panelId: 'p-c' },
  ];

  it('rend role="tablist" et boutons role="tab" avec aria-selected', () => {
    const onChange = vi.fn();
    const { getByRole, getAllByRole } = render(
      <Tabs items={items} active="a" onChange={onChange} ariaLabel="Test" />,
    );
    expect(getByRole('tablist')).toBeDefined();
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
    expect(tabs[0]!.getAttribute('aria-controls')).toBe('p-a');
  });

  it('click sur un tab → onChange', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <Tabs items={items} active="a" onChange={onChange} ariaLabel="Test" />,
    );
    fireEvent.click(getAllByRole('tab')[1]!);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('navigation clavier : ArrowRight, ArrowLeft, Home, End', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <Tabs items={items} active="a" onChange={onChange} ariaLabel="Test" />,
    );
    const [a, b, c] = getAllByRole('tab') as [HTMLElement, HTMLElement, HTMLElement];

    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');

    onChange.mockClear();
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c'); // wrap-around

    onChange.mockClear();
    fireEvent.keyDown(b, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('a');

    onChange.mockClear();
    fireEvent.keyDown(a, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');

    // Touche non-flèche : aucun appel
    onChange.mockClear();
    fireEvent.keyDown(c, { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tabIndex : actif=0, autres=-1 (managed focus pattern)', () => {
    const { getAllByRole } = render(
      <Tabs items={items} active="b" onChange={vi.fn()} ariaLabel="Test" />,
    );
    const [a, b, c] = getAllByRole('tab') as [HTMLElement, HTMLElement, HTMLElement];
    expect(a.tabIndex).toBe(-1);
    expect(b.tabIndex).toBe(0);
    expect(c.tabIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// ToggleBar
// ---------------------------------------------------------------------------

describe('ToggleBar (primitive)', () => {
  const options = [
    { value: 'x', label: 'X' },
    { value: 'y', label: 'Y' },
    { value: 'z', label: 'Z', disabled: true },
  ] as const;

  it('rend role="radiogroup" + role="radio" avec aria-checked', () => {
    const { getByRole, getAllByRole } = render(
      <ToggleBar options={options} value="x" onChange={vi.fn()} ariaLabel="Test" />,
    );
    expect(getByRole('radiogroup')).toBeDefined();
    const radios = getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false');
  });

  it('click sur option active → onChange', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <ToggleBar options={options} value="x" onChange={onChange} ariaLabel="Test" />,
    );
    fireEvent.click(getAllByRole('radio')[1]!);
    expect(onChange).toHaveBeenCalledWith('y');
  });

  it('option disabled : aria-disabled="true", click sans effet', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <ToggleBar options={options} value="x" onChange={onChange} ariaLabel="Test" />,
    );
    const disabledBtn = getAllByRole('radio')[2]!;
    expect(disabledBtn.getAttribute('aria-disabled')).toBe('true');
    expect(disabledBtn.tabIndex).toBe(-1);
    fireEvent.click(disabledBtn);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

describe('Checkbox (primitive)', () => {
  it('rend un checkbox lié à son label via htmlFor/id (useId)', () => {
    const { getByRole, getByLabelText } = render(
      <Checkbox checked={false} onChange={vi.fn()} label="Option A" />,
    );
    expect(getByRole('checkbox')).toBe(getByLabelText('Option A'));
  });

  it('état contrôlé : checked=true → data-checked="true" sur label', () => {
    const { container } = render(<Checkbox checked={true} onChange={vi.fn()} label="X" />);
    const label = container.querySelector('label');
    expect(label?.getAttribute('data-checked')).toBe('true');
  });

  it('toggle via keyboard space : onChange(true)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Checkbox checked={false} onChange={onChange} label="X" />);
    const cb = getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(cb); // checkbox : click = activate
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled : input disabled, pas de call onChange', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Checkbox checked={false} onChange={onChange} label="X" disabled />,
    );
    const cb = getByRole('checkbox') as HTMLInputElement;
    expect(cb.disabled).toBe(true);
  });
});
