import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// Mock viewport (uniform pattern with other tests touching the app).
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(),
    update: vi.fn(),
    unmount: vi.fn(),
    readCameraState: vi.fn(),
    captureAsPng: vi.fn(),
  }));
  return { mockCtor };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { PlanTab2 } from '../src/components/tabs/PlanTab2.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('PlanTab2 (rectangle-packer)', () => {
  it('renders with algoBadge "rectangle-packer" visible', () => {
    const { container } = render(<PlanTab2 />);
    expect(container.textContent).toContain('rectangle-packer');
  });

  it('renders at least 1 SVG for default preset', () => {
    const { container } = render(<PlanTab2 />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders size picker section label', () => {
    const { getByText } = render(<PlanTab2 />);
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
  });

  it('FR→EN switches labels', () => {
    const { getByText, rerender } = render(<PlanTab2 />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<PlanTab2 />);
    expect(getByText('▸ SHEET SIZE')).toBeDefined();
  });
});
