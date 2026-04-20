export interface Telemetry {
  track(event: string, props?: Record<string, unknown>): void;
}
