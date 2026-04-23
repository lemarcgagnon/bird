// scripts/benchmark-cut-plan.ts
//
// Benchmark comparatif shelf-packing vs rectangle-packer sur les 5 presets
// A-E. Pour chaque (preset, algo) : mesure (nombre de panneaux, occupation
// moyenne, occupation min, gaspillage m², overflow, temps moyen 10 runs),
// exporte un SVG par combinaison, produit un RESULT.md + metrics.json.
//
// Exécution : pnpm benchmark:cut-plan
// Prérequis : @nichoir/core build préalable (les imports viennent du dist).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  computeCutLayout,
  computeCutLayoutRectpack,
  generatePlanSVG,
  type CutLayout,
  type Params,
} from '../packages/nichoir-core/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const PRESETS = ['A', 'B', 'C', 'D', 'E'] as const;
type PresetKey = typeof PRESETS[number];
const ALGOS = ['shelf', 'rectpack'] as const;
type AlgoKey = typeof ALGOS[number];

interface Metrics {
  preset: PresetKey;
  algo: AlgoKey;
  panelCount: number;
  meanOccupation: number;
  minOccupation: number;
  wasteTotalM2: number;
  overflowCount: number;
  elapsedMs: number;
}

// Defaults pour les champs absents des anciennes fixtures
const PARAM_DEFAULTS: Partial<Params> = {
  doorFace: 'front',
  hang: false,
  hangPosY: 50,
  hangOffsetX: 0,
  hangDiam: 6,
};

function loadPresetParams(letter: PresetKey): Params {
  const fixturePath = join(ROOT, 'packages/nichoir-core/tests/fixtures', `preset${letter}.snapshot.json`);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { state: { params: Partial<Params> } };
  return { ...PARAM_DEFAULTS, ...fixture.state.params } as Params;
}

function runAlgo(algo: AlgoKey, params: Params): { layout: CutLayout; elapsedMs: number } {
  const fn = algo === 'shelf' ? computeCutLayout : computeCutLayoutRectpack;
  // Warmup (JIT)
  for (let i = 0; i < 3; i++) fn(params);
  // Measure over N runs
  const N = 10;
  const t0 = performance.now();
  let layout: CutLayout = fn(params);
  for (let i = 1; i < N; i++) layout = fn(params);
  const t1 = performance.now();
  return { layout, elapsedMs: (t1 - t0) / N };
}

function computeMetrics(preset: PresetKey, algo: AlgoKey, layout: CutLayout, elapsedMs: number): Metrics {
  const panelCount = layout.panels.length;
  const minOccupation = panelCount > 0
    ? Math.min(...layout.panels.map(p => p.occupation))
    : 0;
  const wasteTotalMm2 = layout.panels.reduce(
    (acc, p) => acc + (p.shW * p.shH - p.usedArea),
    0,
  );
  return {
    preset,
    algo,
    panelCount,
    meanOccupation: layout.meanOccupation,
    minOccupation,
    wasteTotalM2: wasteTotalMm2 / 1e6,
    overflowCount: layout.overflow.length,
    elapsedMs,
  };
}

function writeArtifactSvg(outDir: string, preset: PresetKey, algo: AlgoKey, layout: CutLayout): string {
  const idTrans = (k: string): string => k;
  const svgs = layout.panels.map((panel, i) => {
    const inner = generatePlanSVG(panel, idTrans);
    return `<!-- Panel ${i + 1} -->\n${inner}`;
  });
  const aggregated = svgs.length > 0 ? svgs.join('\n\n') : '<!-- 0 panels -->';
  const fname = `preset-${preset}-${algo}.svg`;
  writeFileSync(join(outDir, fname), aggregated, 'utf8');
  return fname;
}

function formatTable(metrics: Metrics[]): string {
  const header = '| Preset | Algo     | Panneaux | Occup. moy. | Occup. min | Gaspillage (m²) | Overflow | Temps (ms) |\n';
  const sep    = '|--------|----------|---------:|------------:|-----------:|----------------:|---------:|-----------:|\n';
  const rows = metrics.map(m =>
    `| ${m.preset}      | ${m.algo.padEnd(8)} | ${String(m.panelCount).padStart(8)} | ${(m.meanOccupation * 100).toFixed(1).padStart(10)}% | ${(m.minOccupation * 100).toFixed(1).padStart(9)}% | ${m.wasteTotalM2.toFixed(4).padStart(15)} | ${String(m.overflowCount).padStart(8)} | ${m.elapsedMs.toFixed(3).padStart(10)} |`,
  ).join('\n');
  return header + sep + rows;
}

function aggregateByAlgo(
  metrics: Metrics[],
  algo: AlgoKey,
  field: 'panelCount' | 'meanOccupation' | 'minOccupation' | 'wasteTotalM2' | 'elapsedMs',
): { sum: number; mean: number } {
  const vals = metrics.filter(m => m.algo === algo).map(m => m[field]);
  const sum = vals.reduce((a, b) => a + b, 0);
  return { sum, mean: vals.length > 0 ? sum / vals.length : 0 };
}

function formatResult(metrics: Metrics[]): string {
  const shelfPanels = aggregateByAlgo(metrics, 'shelf', 'panelCount');
  const rectPanels  = aggregateByAlgo(metrics, 'rectpack', 'panelCount');
  const shelfOcc    = aggregateByAlgo(metrics, 'shelf', 'meanOccupation');
  const rectOcc     = aggregateByAlgo(metrics, 'rectpack', 'meanOccupation');
  const shelfMinOcc = aggregateByAlgo(metrics, 'shelf', 'minOccupation');
  const rectMinOcc  = aggregateByAlgo(metrics, 'rectpack', 'minOccupation');
  const shelfWaste  = aggregateByAlgo(metrics, 'shelf', 'wasteTotalM2');
  const rectWaste   = aggregateByAlgo(metrics, 'rectpack', 'wasteTotalM2');
  const shelfMs     = aggregateByAlgo(metrics, 'shelf', 'elapsedMs');
  const rectMs      = aggregateByAlgo(metrics, 'rectpack', 'elapsedMs');

  const fmt = (v: number, dec = 2): string => v.toFixed(dec);
  const winner = (shelfVal: number, rectVal: number, lowerIsBetter: boolean): string => {
    if (Math.abs(shelfVal - rectVal) < 1e-6) return 'égalité';
    const shelfWins = lowerIsBetter ? shelfVal < rectVal : shelfVal > rectVal;
    return shelfWins ? '**shelf**' : '**rectpack**';
  };

  return `# Benchmark — shelf-packing multi-bin vs rectangle-packer multi-bin

**Date** : 2026-04-23
**Machine** : ${process.platform} ${process.arch}, Node ${process.version}

## Problème
Deux algorithmes 2D disponibles dans \`@nichoir/core\`. Critère : meilleure
répartition sur les 5 presets de référence A-E.

## Matériaux examinés
- \`packages/nichoir-core/src/cut-plan.ts\` — shelf-packing (multi-bin)
- \`packages/nichoir-core/src/cut-plan-rectpack.ts\` — rectangle-packer wrapper
- 5 fixtures \`preset{A..E}.snapshot.json\`
- \`rectangle-packer@1.0.4\` (npm, MIT, zero deps)

## Résultats bruts

${formatTable(metrics)}

## Résultats par critère

### Nb panneaux (moins = mieux)
- shelf    : somme = ${shelfPanels.sum}, moyenne = ${fmt(shelfPanels.mean)}
- rectpack : somme = ${rectPanels.sum}, moyenne = ${fmt(rectPanels.mean)}
- gagnant  : ${winner(shelfPanels.mean, rectPanels.mean, true)}

### Occupation moyenne (plus = mieux)
- shelf    : moyenne = ${fmt(shelfOcc.mean * 100)}%
- rectpack : moyenne = ${fmt(rectOcc.mean * 100)}%
- gagnant  : ${winner(shelfOcc.mean, rectOcc.mean, false)}

### Occupation minimale (plus = mieux)
- shelf    : moyenne = ${fmt(shelfMinOcc.mean * 100)}%
- rectpack : moyenne = ${fmt(rectMinOcc.mean * 100)}%
- gagnant  : ${winner(shelfMinOcc.mean, rectMinOcc.mean, false)}

### Gaspillage total (moins = mieux)
- shelf    : somme = ${fmt(shelfWaste.sum, 4)} m²
- rectpack : somme = ${fmt(rectWaste.sum, 4)} m²
- gagnant  : ${winner(shelfWaste.sum, rectWaste.sum, true)}

### Temps d'exécution (information)
- shelf    : moyenne = ${fmt(shelfMs.mean, 3)} ms
- rectpack : moyenne = ${fmt(rectMs.mean, 3)} ms

## Cause racine du verdict
[à compléter après inspection visuelle des SVG dans \`artifacts/\`]

Éléments objectifs :
- rectangle-packer utilise l'heuristique RectBestAreaFit + SplitShorterLeftoverAxis, sans rotation (\`allowFlip=false\`).
- shelf-packing utilise le tri par hauteur desc + placement shelf classique avec rotation.
- Les deux algos reçoivent la même cut list (façades en boîte englobante).

## Verdict candidat
- [ ] shelf gagne
- [ ] rectpack gagne
- [ ] égalité — je garde le plus simple (shelf, pas de dépendance externe)

## Incertitude résiduelle
- Les 5 presets ne couvrent pas tous les cas atypiques (panneaux très
  petits, configurations extrêmes de taperX ou ridge=miter).
- Temps machine-dépendant, pas comparable cross-platform.
- rectangle-packer est peu maintenu (v1.0.4 stable depuis années) — si
  retenu, on assume le maintien.
- rectangle-packer \`allowFlip=false\` : la lib ne propage pas width/height
  post-rotation dans \`usedRectangles\`, donc la rotation a été désactivée.
  Ceci peut désavantager l'algo empiriquement.
`;
}

async function main(): Promise<void> {
  const outDir = join(ROOT, 'runs/2026-04-23-coupe');
  const artifactsDir = join(outDir, 'artifacts');
  const stateDir = join(outDir, 'state');
  if (!existsSync(artifactsDir)) mkdirSync(artifactsDir, { recursive: true });
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

  const allMetrics: Metrics[] = [];
  const artifactsManifest: Array<{ path: string; preset: PresetKey; algo: AlgoKey }> = [];

  for (const preset of PRESETS) {
    const params = loadPresetParams(preset);
    for (const algo of ALGOS) {
      console.log(`Running preset=${preset} algo=${algo}…`);
      const { layout, elapsedMs } = runAlgo(algo, params);
      const m = computeMetrics(preset, algo, layout, elapsedMs);
      allMetrics.push(m);
      const fname = writeArtifactSvg(artifactsDir, preset, algo, layout);
      artifactsManifest.push({ path: fname, preset, algo });
    }
  }

  const resultMd = formatResult(allMetrics);
  writeFileSync(join(outDir, 'RESULT.md'), resultMd, 'utf8');

  writeFileSync(
    join(stateDir, 'metrics.json'),
    JSON.stringify(
      {
        task_id: 'coupe-benchmark',
        status: 'completed',
        runs: allMetrics,
        machine: { platform: process.platform, arch: process.arch, node: process.version },
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(artifactsDir, 'manifest.json'),
    JSON.stringify({ entries: artifactsManifest }, null, 2),
    'utf8',
  );

  writeFileSync(
    join(stateDir, 'NOTES.md'),
    `# NOTES — coupe benchmark\n\n## Observations\n\n(à compléter manuellement après inspection des SVG)\n`,
    'utf8',
  );

  console.log(`\nDone. See ${join(outDir, 'RESULT.md')}.`);
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
