import type { CreditGate, ExportKind } from '../ports/CreditGate.js';

export class FakeCreditGate implements CreditGate {
  canExport(_kind: ExportKind): Promise<boolean> {
    return Promise.resolve(true);
  }

  onExportConsumed(_kind: ExportKind, _bytes: number): Promise<void> {
    return Promise.resolve();
  }
}
