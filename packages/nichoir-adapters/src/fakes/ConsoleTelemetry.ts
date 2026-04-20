import type { Telemetry } from '../ports/Telemetry.js';

export class ConsoleTelemetry implements Telemetry {
  track(event: string, props?: Record<string, unknown>): void {
    console.debug('[telemetry]', event, props ?? {});
  }
}
