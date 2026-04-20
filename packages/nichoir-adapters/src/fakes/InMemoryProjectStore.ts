import type { NichoirState } from '@nichoir/core';
import type { ProjectStore, ProjectMeta } from '../ports/ProjectStore.js';

interface Entry {
  state: NichoirState;
  meta: ProjectMeta;
}

export class InMemoryProjectStore implements ProjectStore {
  private readonly store = new Map<string, Entry>();

  async load(id: string): Promise<NichoirState | null> {
    return this.store.get(id)?.state ?? null;
  }

  async save(state: NichoirState, opts?: { id?: string; name?: string }): Promise<{ id: string }> {
    const now = new Date().toISOString();
    if (opts?.id !== undefined) {
      const existing = this.store.get(opts.id);
      const meta: ProjectMeta = {
        id: opts.id,
        name: opts.name ?? existing?.meta.name ?? opts.id,
        createdAt: existing?.meta.createdAt ?? now,
        updatedAt: now,
        ownerId: existing?.meta.ownerId ?? '',
      };
      this.store.set(opts.id, { state, meta });
      return { id: opts.id };
    } else {
      const id = crypto.randomUUID();
      const meta: ProjectMeta = {
        id,
        name: opts?.name ?? id,
        createdAt: now,
        updatedAt: now,
        ownerId: '',
      };
      this.store.set(id, { state, meta });
      return { id };
    }
  }

  async list(): Promise<ProjectMeta[]> {
    return Array.from(this.store.values()).map((e) => e.meta);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
