# `@nichoir/adapters` — Port Contracts

> **Source d'autorité pour les ports d'intégration SaaS.**
> Chaque port est une interface TypeScript. Deux implémentations vivent dans ce package :
> - `src/fakes/*` — implémentations permissives, pour dev et tests P2
> - `src/real/*` — implémentations branchées sur le SaaS, activées en P3
>
> Les consommateurs (`nichoir-ui`, routes Next.js) n'importent que les **interfaces** et un **factory** qui choisit l'impl au runtime.

**Version du contrat** : 0.1.0 (figée pour P0–P1)

---

## Invariants

**A1 — Async par défaut.** Toute opération qui PEUT un jour taper le réseau est `Promise<T>`, même si la fake impl résout synchrone. Pas de conversion sync→async à posteriori.

**A2 — Server-authoritative capable.** `CreditGate.canExport()` est un check qui peut être un appel API. La fake retourne toujours `true`, mais la structure permet une impl server-side sans refactor UI.

**A3 — Pas de DOM dans les interfaces.** Les signatures ne référencent pas `HTMLElement`, `Blob`, `File`, etc. Quand un port agit sur un navigateur (ex: déclencher un download), il prend des types primitifs (`Uint8Array`, `string`) et c'est l'implémentation qui gère.

**A4 — Pas de React.** Les interfaces sont utilisables par du code non-React (route handlers, background jobs). Les hooks React qui enveloppent ces ports vivent dans `nichoir-ui`.

**A5 — Fakes sont du code, pas de la doc.** Les fake impls sont dans `src/fakes/` et exportées. Aucune duplication en markdown.

---

## Ports

### 1. `CreditGate` — gating des actions payantes

```ts
export type ExportKind =
  | 'stl-house'
  | 'stl-door'
  | 'stl-zip'
  | 'plan-png'
  | 'plan-svg';

export interface CreditGate {
  /** Vérifie si l'utilisateur peut consommer un crédit pour cette action.
   *  Peut interroger un backend. Retourne `true` si autorisé. */
  canExport(kind: ExportKind): Promise<boolean>;

  /** Notifie la consommation effective d'un crédit après succès.
   *  Utilisé pour décrémenter le solde et loguer l'audit. */
  onExportConsumed(kind: ExportKind, bytes: number): Promise<void>;
}
```

**Responsabilités** :
- `canExport` est **server-authoritative** quand branché. Le client ne décide pas seul.
- `onExportConsumed` est appelé **après** la génération réussie et le download.
- Toute politique produit (1 crédit = 1 STL, ou 1 crédit = tous les formats d'un projet) est encodée ici, pas dans la UI ni dans le core.

**Fake** : `FakeCreditGate` → toujours `Promise.resolve(true)` + no-op.

---

### 2. `ProjectStore` — persistance des projets

```ts
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
```

**Responsabilités** :
- `ProjectStore` est la seule porte vers la persistance. UI ne tape jamais la DB directement.
- **La sérialisation est la responsabilité de l'implémentation**, pas du contrat.

**⚠️ Pièges de sérialisation à gérer par chaque impl** :

- `Uint8ClampedArray` (dans `DecoSlotCore.heightmapData`) **ne sérialise PAS** en JSON naïvement :
  `JSON.stringify(new Uint8ClampedArray([1,2,3]))` retourne `"{}"`, pas `"[1,2,3]"`.
  L'impl doit convertir via `Array.from(arr)` à l'écriture et `new Uint8ClampedArray(arr)` à la lecture,
  OU utiliser un format binaire (CBOR, MessagePack).
- `ParsedShape[]` (tableau d'objets `{x, y}`) sérialise correctement en JSON natif — aucune précaution.
- Les champs Three.js (`BufferGeometry`, `Shape`, `Plane`) ne sont JAMAIS dans `NichoirState` côté core
  (ils sont dans la forme runtime UI, reconvertis via `DecoSlotCore`).

Chaque impl doit fournir une suite de tests round-trip (save → load → deep-equal).

**Fake** : `InMemoryProjectStore` → `Map<string, NichoirState>` + timestamps.
Pas de sérialisation (références directes), donc le piège ci-dessus ne s'applique pas.
Les impls réelles (Postgres, Supabase, etc.) doivent l'adresser explicitement.

---

### 3. `AuthContext` — identité utilisateur

```ts
export interface AuthContext {
  readonly userId: string | null;
  readonly isAuthenticated: boolean;
}
```

**Responsabilités** :
- Fournir l'identité en lecture seule. Pas de login/logout ici — ces flux sont du SaaS hôte, pas du module.
- `userId: null` + `isAuthenticated: false` = mode invité (allowed par défaut dans la fake).

**Fake** : objet littéral, pas une classe :
```ts
export const FakeAuthContext: AuthContext = {
  userId: 'dev-user',
  isAuthenticated: true,
};
```
(Le factory utilise une référence, pas `new FakeAuthContext()`. Voir la section Factory plus bas.)

---

### 4. `Telemetry` — événements applicatifs

```ts
export interface Telemetry {
  track(event: string, props?: Record<string, unknown>): void;
}
```

**Responsabilités** :
- Logs d'événements structurés : `nichoir.export.started`, `nichoir.export.succeeded`, etc.
- Synchrone et non-awaited par design (fire-and-forget).

**Fake** : `ConsoleTelemetry` → `console.debug('[telemetry]', event, props)`.

---

### 5. `DownloadService` — déclencher un téléchargement client

```ts
export interface DownloadService {
  /** Déclenche le téléchargement de `bytes` sous le nom `filename`
   *  avec le type MIME donné.
   *  L'implémentation browser crée un Blob + <a download>. */
  trigger(
    bytes: Uint8Array | string,
    filename: string,
    mime: string
  ): Promise<void>;
}
```

**⚠️ Dette de contrat assumée pour P0** : la signature retourne `Promise<void>`. Si une future
impl server-side doit retourner une URL signée (ex: upload S3 puis redirect), ce sera un
**breaking change** à réviser avant P3. Acceptable pour P0–P2.

**Responsabilités** :
- Abstraction du download pour permettre tests (mock) et futures alternatives (server-side blob store).
- La fake browser utilise `URL.createObjectURL` + `<a download>` + cleanup.

**Fake** : `BrowserDownloadService` → crée un Blob, un `<a>`, clique, cleanup.
**Fake non-browser (tests)** : `NoopDownloadService` → collecte les appels dans un tableau, pour assertions.

---

## Factory pattern recommandé

Le consumer (Next.js app) choisit les impls au bootstrap :

```ts
// apps/demo/lib/nichoir-env.ts
import {
  FakeCreditGate, InMemoryProjectStore, FakeAuthContext,
  ConsoleTelemetry, BrowserDownloadService
} from '@nichoir/adapters';
// ou en P3 :
// import { RealCreditGate, SupabaseProjectStore, ... } from '@nichoir/adapters';

export const nichoirEnv = {
  credits: new FakeCreditGate(),      // classe : état interne (compteur fake)
  projects: new InMemoryProjectStore(), // classe : Map interne
  auth: FakeAuthContext,                 // objet littéral : pas de new
  telemetry: new ConsoleTelemetry(),    // classe : peut bufferiser
  download: new BrowserDownloadService(), // classe : peut avoir config
};
```

Règle de style : les impls avec état interne sont des **classes** (`new Foo()`), les impls purement déclaratives sans état sont des **objets littéraux**. Chaque fake documente son type dans son fichier source.

`nichoir-ui` consomme `nichoirEnv` via React Context, sans connaître l'impl concrète.

---

## Non-goals (hors ADAPTERS.md)

- **Hooks React** (`useCredits()`, `useProject()`, etc.) — vivent dans `nichoir-ui`, ils enveloppent ces ports. Les interfaces ici sont **framework-agnostic**.
- **Routes Next.js** (`/api/nichoir/*`) — elles consomment ces ports côté serveur, elles ne définissent pas d'interface ici.
- **Modèles de données SaaS** (schema Postgres, etc.) — détail d'implémentation des ports real, pas du contrat.
- **UI de paywall / upsell** — logique produit, vit dans le SaaS hôte, pas dans le module.

---

## Checklist de validation (pour code-reviewer)

- [ ] Chaque port est une `interface` (pas une `class`) dans `src/ports/`
- [ ] Chaque port a au moins une fake impl dans `src/fakes/`, exportée depuis `src/index.ts`
- [ ] `grep -r "react\|next/\|jsx\|tsx" packages/nichoir-adapters/src` retourne **zéro**
- [ ] `grep -r "HTMLElement\|HTMLCanvas\|document\.\|window\." packages/nichoir-adapters/src/ports` retourne **zéro** (autorisé dans `src/fakes/BrowserDownloadService.ts` uniquement)
- [ ] Toutes les signatures qui peuvent potentiellement taper le réseau sont `Promise<T>`
- [ ] `pnpm --filter @nichoir/adapters build` et `test` verts
