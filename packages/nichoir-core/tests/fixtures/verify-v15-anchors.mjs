/**
 * verify-v15-anchors.mjs
 *
 * Garde-fou indépendant : compare les fixtures preset{A,B,C}.snapshot.json
 * contre nichoir_v15.html rendu dans un vrai navigateur headless.
 *
 * Usage : node tests/fixtures/verify-v15-anchors.mjs
 * Prérequis : http-server lancé sur localhost:8765
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL_V15 = 'http://localhost:8765/nichoir_v15.html';

// Chemins vers les fixtures
const FIXTURE_A = join(__dirname, 'presetA.snapshot.json');
const FIXTURE_B = join(__dirname, 'presetB.snapshot.json');
const FIXTURE_C = join(__dirname, 'presetC.snapshot.json');

const TOLERANCE = 0.01; // 1% tolérance relative

// --- Parsing des valeurs v15 depuis le texte DOM ---

/**
 * Inverse de fV(v) = v>1e6 ? (v/1e6).toFixed(2)+' L' : (v/1e3).toFixed(1)+' cm³'
 * Retourne la valeur en mm³.
 */
function parseVolume(text) {
  const t = text.trim();
  const lMatch = t.match(/^([\d.]+)\s*L$/);
  if (lMatch) return parseFloat(lMatch[1]) * 1e6;
  const cm3Match = t.match(/^([\d.]+)\s*cm³$/);
  if (cm3Match) return parseFloat(cm3Match[1]) * 1e3;
  throw new Error(`Format volume non reconnu : "${t}"`);
}

/**
 * Inverse de fA2(v) = (v/100).toFixed(1)+' cm²'
 * Retourne la valeur en mm².
 */
function parseSurface(text) {
  const t = text.trim();
  const cm2Match = t.match(/^([\d.]+)\s*cm²$/);
  if (cm2Match) return parseFloat(cm2Match[1]) * 100;
  throw new Error(`Format surface non reconnu : "${t}"`);
}

function relDelta(a, b) {
  if (a === 0 && b === 0) return 0;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / denom;
}

function check(label, fixtureVal, v15Val, tol) {
  const delta = relDelta(fixtureVal, v15Val);
  const ok = delta <= tol;
  const pct = (delta * 100).toFixed(4);
  const sym = ok ? '✓' : '✗';
  console.log(
    `  ${label.padEnd(18)}: fixture=${fixtureVal.toFixed(2)}, v15=${v15Val.toFixed(2)}, Δrel=${pct}% ${sym}`
  );
  return ok;
}

function checkBool(label, fixtureVal, v15Val) {
  const ok = fixtureVal === v15Val;
  const sym = ok ? '✓' : '✗';
  console.log(
    `  ${label.padEnd(18)}: fixture=${fixtureVal}, v15=${v15Val} ${sym}`
  );
  return ok;
}

// --- Définition des presets ---

const PRESETS = [
  {
    letter: 'A',
    fixture: FIXTURE_A,
    // Preset A = état initial, aucun override
    overrides: async (_page) => { /* rien à faire */ },
  },
  {
    letter: 'B',
    fixture: FIXTURE_B,
    overrides: async (page) => {
      // Sliders: W=180, H=260, D=160, taperX=-20
      for (const [id, value] of [
        ['sg-W', 180],
        ['sg-H', 260],
        ['sg-D', 160],
        ['sg-taperX', -20],
      ]) {
        await page.evaluate(({ id, value }) => {
          const sg = document.getElementById(id);
          const range = sg.querySelector('input[type=range]');
          range.value = String(value);
          range.dispatchEvent(new Event('input', { bubbles: true }));
        }, { id, value });
      }

      // Door type : d'abord sélectionner pentagon pour révéler doorW/doorH
      await page.click('#door-toggle [data-val="pentagon"]');
      // Attendre que doorW devienne visible
      await page.waitForSelector('#sg-doorW input[type=range]', { visible: true, timeout: 5000 });

      // Sliders door
      for (const [id, value] of [
        ['sg-doorW', 45],
        ['sg-doorH', 60],
      ]) {
        await page.evaluate(({ id, value }) => {
          const sg = document.getElementById(id);
          const range = sg.querySelector('input[type=range]');
          range.value = String(value);
          range.dispatchEvent(new Event('input', { bubbles: true }));
        }, { id, value });
      }

      // doorFollowTaper checkbox
      await page.click('#cb-door-follow-taper');

      // perch checkbox → révèle les sliders perch
      await page.click('#cb-perch');
    },
  },
  {
    letter: 'C',
    fixture: FIXTURE_C,
    overrides: async (page) => {
      // slope=60
      await page.evaluate(({ id, value }) => {
        const sg = document.getElementById(id);
        const range = sg.querySelector('input[type=range]');
        range.value = String(value);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }, { id: 'sg-slope', value: 60 });

      // overhang=50
      await page.evaluate(({ id, value }) => {
        const sg = document.getElementById(id);
        const range = sg.querySelector('input[type=range]');
        range.value = String(value);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }, { id: 'sg-overhang', value: 50 });

      // T=18
      await page.evaluate(({ id, value }) => {
        const sg = document.getElementById(id);
        const range = sg.querySelector('input[type=range]');
        range.value = String(value);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }, { id: 'sg-T', value: 18 });

      // ridge=miter
      await page.click('#ridge-toggle [data-val="miter"]');
    },
  },
];

async function runPreset(page, preset) {
  // 1. Reset : recharger la page.
  // `domcontentloaded` + attente explicite du premier render ; `networkidle0` est trop
  // sensible aux requêtes CDN tardives (cdnjs.cloudflare.com peut varier d'un run à l'autre).
  await page.goto(URL_V15, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof window.THREE !== 'undefined' && document.getElementById('v-ext') !== null,
    { timeout: 60000 }
  );

  // 2. Appliquer les overrides
  await preset.overrides(page);

  // 3. Cliquer sur le tab CALCUL
  await page.click('.tab-btn[data-tab="calc"]');

  // Laisser le temps au DOM de se mettre à jour (le v15 est synchrone,
  // mais on attend que #v-ext soit non-vide)
  await page.waitForFunction(
    () => document.getElementById('v-ext')?.textContent?.trim() !== '',
    { timeout: 5000 }
  );

  // 4. Lire les 3 anchors
  const vExtText = await page.$eval('#v-ext', el => el.textContent.trim());
  const vIntText = await page.$eval('#v-int', el => el.textContent.trim());
  const sTotalText = await page.$eval('#s-total', el => el.textContent.trim());

  // 5. Vérifier doorPanel
  const doorPanelChecked = await page.$eval('#cb-door-panel', el => el.checked);

  // 6. Lire le cut-table pour vérifier absence "Porte" (doorPanel row)
  const cutTableHTML = await page.$eval('#cut-table', el => el.innerHTML);
  // La ligne doorPanel affiche 'Porte' comme texte dans c1 (seulement si doorPanel=true)
  const hasDoorPanelRow = cutTableHTML.includes('>Porte<') || cutTableHTML.includes('>Porte ');

  return {
    vExtText,
    vIntText,
    sTotalText,
    doorPanelChecked,
    hasDoorPanelRow,
  };
}

/**
 * Résolution du binaire Chrome/Chromium en mode portable :
 *   1. $CHROME_EXECUTABLE ou $PUPPETEER_EXECUTABLE_PATH si définies
 *   2. premier chemin candidat qui existe parmi une liste standard (Linux + macOS)
 * Throw si rien trouvé — évite un crash opaque de puppeteer.
 */
function resolveChromePath() {
  const envPath = process.env.CHROME_EXECUTABLE ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) return envPath;

  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  throw new Error(
    "Aucun binaire Chrome/Chromium trouvé. Définis CHROME_EXECUTABLE ou PUPPETEER_EXECUTABLE_PATH."
  );
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: resolveChromePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  let totalPassed = 0;
  let totalFailed = 0;
  const failures = [];

  for (const preset of PRESETS) {
    console.log(`\nPreset ${preset.letter}:`);

    // Charger la fixture
    const fixture = JSON.parse(readFileSync(preset.fixture, 'utf-8'));
    const calc = fixture.reference.calculations;
    const fixtureVolExt = calc.volumes.ext;
    const fixtureVolInt = calc.volumes.int;
    const fixtureSurfTotal = calc.surfaces.total;
    const fixtureDoorPanel = fixture.state.params.doorPanel; // false pour A, B, C

    let result;
    try {
      result = await runPreset(page, preset);
    } catch (err) {
      console.log(`  ERREUR lors du run : ${err.message}`);
      failures.push(`Preset ${preset.letter}: erreur puppeteer — ${err.message}`);
      totalFailed += 4;
      continue;
    }

    // Parser les valeurs v15
    let v15VolExt, v15VolInt, v15SurfTotal;
    try {
      v15VolExt = parseVolume(result.vExtText);
      v15VolInt = parseVolume(result.vIntText);
      v15SurfTotal = parseSurface(result.sTotalText);
    } catch (err) {
      console.log(`  ERREUR parsing : ${err.message}`);
      console.log(`    v-ext="${result.vExtText}", v-int="${result.vIntText}", s-total="${result.sTotalText}"`);
      failures.push(`Preset ${preset.letter}: erreur parsing — ${err.message}`);
      totalFailed += 3;
      continue;
    }

    // Comparer
    const okExt = check('volumes.ext', fixtureVolExt, v15VolExt, TOLERANCE);
    const okInt = check('volumes.int', fixtureVolInt, v15VolInt, TOLERANCE);
    const okSurf = check('surfaces.total', fixtureSurfTotal, v15SurfTotal, TOLERANCE);

    // doorPanel : fixture=false et v15 unchecked + pas de ligne 'Porte'
    const v15DoorPanel = result.doorPanelChecked || result.hasDoorPanelRow;
    const okDoorPanel = checkBool('doorPanel', fixtureDoorPanel, v15DoorPanel);

    const presetPassed = [okExt, okInt, okSurf, okDoorPanel].filter(Boolean).length;
    const presetFailed = 4 - presetPassed;
    totalPassed += presetPassed;
    totalFailed += presetFailed;

    if (!okExt) failures.push(`Preset ${preset.letter} volumes.ext: fixture=${fixtureVolExt.toFixed(2)}, v15=${v15VolExt.toFixed(2)}`);
    if (!okInt) failures.push(`Preset ${preset.letter} volumes.int: fixture=${fixtureVolInt.toFixed(2)}, v15=${v15VolInt.toFixed(2)}`);
    if (!okSurf) failures.push(`Preset ${preset.letter} surfaces.total: fixture=${fixtureSurfTotal.toFixed(2)}, v15=${v15SurfTotal.toFixed(2)}`);
    if (!okDoorPanel) failures.push(`Preset ${preset.letter} doorPanel: fixture=${fixtureDoorPanel}, v15=${v15DoorPanel}`);
  }

  await browser.close();

  const totalChecks = PRESETS.length * 4;
  const allGreen = totalFailed === 0;

  console.log('\n' + '─'.repeat(50));
  if (allGreen) {
    console.log(`Résultat : ${PRESETS.length}/${PRESETS.length} presets GREEN`);
  } else {
    console.log(`Résultat : ${totalPassed}/${totalChecks} checks passent — ${totalFailed} FAILED`);
    console.log('\nDétail des échecs :');
    for (const f of failures) {
      console.log(`  ✗ ${f}`);
    }
  }

  process.exit(allGreen ? 0 : 1);
}

main().catch(err => {
  console.error('Erreur fatale :', err.message);
  process.exit(1);
});
