import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, renderHook } from '@testing-library/react';
import type { DownloadService } from '@nichoir/adapters';
import {
  DownloadServiceProvider,
  useDownloadService,
} from '../src/adapters/DownloadServiceContext.js';

function makeStubService(): DownloadService {
  return { trigger: vi.fn(async () => {}) };
}

beforeEach(() => { cleanup(); });

describe('DownloadServiceContext', () => {
  it('useDownloadService sans Provider → throw Error explicite', () => {
    // Silencer le console.error de React pour l'erreur attendue
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useDownloadService())).toThrow(
      /useDownloadService called outside DownloadServiceProvider/,
    );
    spy.mockRestore();
  });

  it('useDownloadService dans Provider → retourne l\'instance fournie', () => {
    const service = makeStubService();
    const { result } = renderHook(() => useDownloadService(), {
      wrapper: ({ children }) => (
        <DownloadServiceProvider service={service}>
          {children}
        </DownloadServiceProvider>
      ),
    });
    expect(result.current).toBe(service);
  });

  it('2 composants enfants accèdent au MÊME service', () => {
    const service = makeStubService();
    let svcA: DownloadService | null = null;
    let svcB: DownloadService | null = null;
    function A(): React.JSX.Element { svcA = useDownloadService(); return <div>A</div>; }
    function B(): React.JSX.Element { svcB = useDownloadService(); return <div>B</div>; }
    render(
      <DownloadServiceProvider service={service}>
        <A /><B />
      </DownloadServiceProvider>,
    );
    expect(svcA).toBe(service);
    expect(svcB).toBe(service);
    expect(svcA).toBe(svcB);
  });

  it('changement de `service` prop → les consumers voient la nouvelle instance', () => {
    const s1 = makeStubService();
    const s2 = makeStubService();
    let latest: DownloadService | null = null;
    function Consumer(): React.JSX.Element {
      latest = useDownloadService();
      return <div>C</div>;
    }
    const { rerender } = render(
      <DownloadServiceProvider service={s1}>
        <Consumer />
      </DownloadServiceProvider>,
    );
    expect(latest).toBe(s1);
    rerender(
      <DownloadServiceProvider service={s2}>
        <Consumer />
      </DownloadServiceProvider>,
    );
    expect(latest).toBe(s2);
  });
});
