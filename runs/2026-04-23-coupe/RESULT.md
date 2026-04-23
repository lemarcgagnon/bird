# Benchmark — shelf-packing multi-bin vs rectangle-packer multi-bin

**Date** : 2026-04-23
**Machine** : linux x64, Node v22.14.0

## Problème
Deux algorithmes 2D disponibles dans `@nichoir/core`. Critère : meilleure
répartition sur les 5 presets de référence A-E.

## Matériaux examinés
- `packages/nichoir-core/src/cut-plan.ts` — shelf-packing (multi-bin)
- `packages/nichoir-core/src/cut-plan-rectpack.ts` — rectangle-packer wrapper
- 5 fixtures `preset{A..E}.snapshot.json`
- `rectangle-packer@1.0.4` (npm, MIT, zero deps)

## Résultats bruts

| Preset | Algo     | Panneaux | Occup. moy. | Occup. min | Gaspillage (m²) | Overflow | Temps (ms) |
|--------|----------|---------:|------------:|-----------:|----------------:|---------:|-----------:|
| A      | shelf    |        1 |        7.7% |       7.7% |          2.7484 |        0 |      0.025 |
| A      | rectpack |        1 |        7.7% |       7.7% |          2.7484 |        0 |      0.034 |
| B      | shelf    |        1 |        9.1% |       9.1% |          2.7067 |        0 |      0.008 |
| B      | rectpack |        1 |        9.1% |       9.1% |          2.7067 |        0 |      0.031 |
| C      | shelf    |        1 |       11.3% |      11.3% |          2.6407 |        0 |      0.007 |
| C      | rectpack |        1 |       11.3% |      11.3% |          2.6407 |        0 |      0.019 |
| D      | shelf    |        1 |        7.7% |       7.7% |          2.7484 |        0 |      0.006 |
| D      | rectpack |        1 |        7.7% |       7.7% |          2.7484 |        0 |      0.024 |
| E      | shelf    |        1 |        7.7% |       7.7% |          2.7468 |        0 |      0.007 |
| E      | rectpack |        1 |        7.7% |       7.7% |          2.7468 |        0 |      0.031 |

## Résultats par critère

### Nb panneaux (moins = mieux)
- shelf    : somme = 5, moyenne = 1.00
- rectpack : somme = 5, moyenne = 1.00
- gagnant  : égalité

### Occupation moyenne (plus = mieux)
- shelf    : moyenne = 8.69%
- rectpack : moyenne = 8.69%
- gagnant  : égalité

### Occupation minimale (plus = mieux)
- shelf    : moyenne = 8.69%
- rectpack : moyenne = 8.69%
- gagnant  : égalité

### Gaspillage total (moins = mieux)
- shelf    : somme = 13.5911 m²
- rectpack : somme = 13.5911 m²
- gagnant  : égalité

### Temps d'exécution (information)
- shelf    : moyenne = 0.010 ms
- rectpack : moyenne = 0.028 ms

## Cause racine du verdict
[à compléter après inspection visuelle des SVG dans `artifacts/`]

Éléments objectifs :
- rectangle-packer utilise l'heuristique RectBestAreaFit + SplitShorterLeftoverAxis, sans rotation (`allowFlip=false`).
- shelf-packing utilise le tri par hauteur desc + placement shelf classique avec rotation.
- Les deux algos reçoivent la même cut list (façades en boîte englobante).

## Verdict candidat
- [x] **shelf gagne** (décision user 2026-04-23)
- [ ] rectpack gagne
- [ ] égalité — je garde le plus simple (shelf, pas de dépendance externe)

### Rationale du verdict

Le benchmark sur les 5 presets montrait une **égalité chiffrée** parce que chaque config tient sur 1 panneau 1220×2440 mm — cas où les 2 algos convergent.

**En test manuel avec des panneaux plus petits (forçant le multi-bin)**, l'utilisateur constate empiriquement que `rectangle-packer` est **moins efficace** (plus de panneaux, occupation moindre). Cause identifiée : la lib ne propage pas les `width`/`height` post-rotation dans `usedRectangles`, imposant `allowFlip=false` dans notre wrapper → rectangle-packer ne peut pas utiliser la rotation, alors que shelf-packing le fait et gagne en densité.

**Conclusion** : shelf-packing gagne. Suppression du codebase via branche `cleanup-cut-plan`.

## Incertitude résiduelle
- Les 5 presets ne couvrent pas tous les cas atypiques (panneaux très
  petits, configurations extrêmes de taperX ou ridge=miter).
- Temps machine-dépendant, pas comparable cross-platform.
- rectangle-packer est peu maintenu (v1.0.4 stable depuis années) — si
  retenu, on assume le maintien.
- rectangle-packer `allowFlip=false` : la lib ne propage pas width/height
  post-rotation dans `usedRectangles`, donc la rotation a été désactivée.
  Ceci peut désavantager l'algo empiriquement.
