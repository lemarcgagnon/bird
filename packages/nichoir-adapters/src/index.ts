export const ADAPTERS_VERSION = '0.1.0';

// Ports (types uniquement)
export type { ExportKind, CreditGate } from './ports/CreditGate.js';
export type { ProjectMeta, ProjectStore } from './ports/ProjectStore.js';
export type { AuthContext } from './ports/AuthContext.js';
export type { Telemetry } from './ports/Telemetry.js';
export type { DownloadService } from './ports/DownloadService.js';

// Fakes
export { FakeCreditGate } from './fakes/FakeCreditGate.js';
export { InMemoryProjectStore } from './fakes/InMemoryProjectStore.js';
export { FakeAuthContext } from './fakes/FakeAuthContext.js';
export { ConsoleTelemetry } from './fakes/ConsoleTelemetry.js';
export { BrowserDownloadService } from './fakes/BrowserDownloadService.js';
export { NoopDownloadService, type NoopDownloadCall } from './fakes/NoopDownloadService.js';
