import type { NichoirState } from '@nichoir/core';

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  ownerId: string;
}

export interface ProjectStore {
  load(id: string): Promise<NichoirState | null>;

  save(state: NichoirState, opts?: {
    id?: string;       // si omis → create ; si fourni → update
    name?: string;
  }): Promise<{ id: string }>;

  list(): Promise<ProjectMeta[]>;

  delete(id: string): Promise<void>;
}
