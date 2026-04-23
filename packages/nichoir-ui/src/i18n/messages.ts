// src/i18n/messages.ts
//
// Messages i18n plats (clé → traduction). Port de `src/translations.js` du v15.
// Stratégie : onglet par onglet (codex guardrail).
//   - P2.2a : app.*, tab.*, lang.*, tab.placeholder.construction
//   - P2.2b : dim.* (uniquement les clés rendues par DimTab)
//   - P2.3+ : vue.*, deco.*, calc.*, plan.*, export.*
//
// Fallback : `useT(key)` retourne la clé brute si non trouvée (pas de throw).

export type Lang = 'fr' | 'en';

export const MESSAGES: Record<Lang, Record<string, string>> = {
  fr: {
    // App
    'app.title': '⌂ NICHOIR',
    'app.subtitle': 'CALCULATEUR MAISON D\'OISEAU',

    // Tabs
    'tab.dim': 'DIM.',
    'tab.vue': 'VUE',
    'tab.deco': 'DÉCOR',
    'tab.calc': 'CALCUL',
    'tab.plan': 'PLAN',
    'tab.export': 'EXPORT',
    'tab.placeholder.construction': 'Onglet en cours de construction. Les contrôles arrivent aux phases suivantes.',

    // Language / theme switcher
    'lang.label': 'Langue',
    'lang.theme.toDark': 'Passer en mode sombre',
    'lang.theme.toLight': 'Passer en mode clair',

    // DIM — Body section
    'dim.body': '▸ CORPS (BOÎTE)',
    'dim.width': 'Largeur (X)',
    'dim.height': 'Hauteur (Y)',
    'dim.depth': 'Profondeur (Z)',
    'dim.taperX': 'Évasement X',
    'dim.taperHint': 'Largeur bas = largeur haut + 2× évasement. Valeur positive = bas plus large (évasé). Valeur négative = bas plus étroit (rétréci). Le toit reste à la largeur du haut.',

    // DIM — Floor
    'dim.floor': '▸ ASSEMBLAGE PLANCHER',
    'dim.floor.enclave': 'Enclavé',
    'dim.floor.enclave.note': 'plancher entre murs',
    'dim.floor.pose': 'Posé',
    'dim.floor.pose.note': 'murs sur plancher',

    // DIM — Roof
    'dim.roof': '▸ TOITURE',
    'dim.slope': 'Pente du toit',
    'dim.overhang': 'Débordement (pluie)',

    // DIM — Ridge
    'dim.ridge': '▸ JONCTION CRÊTE DU TOIT',
    'dim.ridge.left': 'Gauche recouvre',
    'dim.ridge.left.note': '+T sur toit gauche',
    'dim.ridge.right': 'Droit recouvre',
    'dim.ridge.right.note': '+T sur toit droit',
    'dim.ridge.miter': 'Onglet',
    'dim.ridge.miter.note': 'biseau à θ',

    // DIM — Material
    'dim.material': '▸ MATÉRIAU',
    'dim.thickness': 'Épaisseur parois',

    // DIM — Door
    'dim.door': '▸ PORTE D\'ENTRÉE',
    'dim.door.none': 'Aucune',
    'dim.door.round': 'Ronde',
    'dim.door.square': 'Carrée',
    'dim.door.pentagon': 'Penta.',
    'dim.door.face': 'Façade de la porte',
    'dim.door.face.front': 'Devant',
    'dim.door.face.left': 'Gauche',
    'dim.door.face.right': 'Droite',
    'dim.door.width': 'Largeur porte',
    'dim.door.height': 'Hauteur porte',
    'dim.door.posX': 'Position horiz.',
    'dim.door.posY': 'Position vert.',
    'dim.door.createPanel': 'Créer le panneau de porte',
    'dim.door.adjust': 'Ajustement',
    'dim.door.adjust.hint': '100% = même taille que le trou',
    'dim.door.followTaper': 'Côtés de la porte suivent l\'évasement',
    'dim.door.followTaper.hint': 'Porte pentagone uniquement. Les côtés s\'inclinent au même angle que les murs.',

    // DIM — Accessories (group header)
    'dim.accessories': '▸ ACCESSOIRES',

    // DIM — Perch
    'dim.perch': '▸ PERCHOIR',
    'dim.perch.add': 'Ajouter un perchoir',
    'dim.perch.diameter': 'Diamètre',
    'dim.perch.length': 'Longueur',
    'dim.perch.offset': 'Sous la porte',

    // DIM — Hang (trous de suspension)
    'dim.hang': '▸ SUSPENSION',
    'dim.hang.add': 'Ajouter trous de suspension (débordement toit)',
    'dim.hang.posY': 'Distance depuis bord',
    'dim.hang.offsetX': 'Distance depuis crête',
    'dim.hang.diameter': 'Diamètre trou',

    // VUE — port v15 fidèle (src/translations.js:93-103). `vue.controls.hint`
    // reporté volontairement : le hint v15 utilise du HTML inline avec <br>,
    // incompatible avec notre politique "pas de dangerouslySetInnerHTML".
    'vue.mode': '▸ MODE D\'AFFICHAGE',
    'vue.mode.solid': 'Solide',
    'vue.mode.wireframe': 'Fil fer',
    'vue.mode.xray': 'X-Ray',
    'vue.mode.edges': 'Arêtes',
    'vue.explode': '▸ VUE ÉCLATÉE',
    'vue.explode.label': 'Séparation panneaux',
    'vue.palette': '▸ COULEURS DU MODÈLE',
    'vue.palette.wood': 'Bois naturel',
    'vue.palette.wood-contrast': 'Bois contrasté',
    'vue.palette.colorful': 'Couleurs distinctes',
    'vue.palette.mono': 'Monochrome',
    'vue.clip': '▸ COUPES DE SECTION',
    'vue.clip.x': 'Coupe X',
    'vue.clip.y': 'Coupe Y',
    'vue.clip.z': 'Coupe Z',

    // DÉCOR P2.7a — port v15 fidèle (src/translations.js:107-113, 116).
    // Clés `deco.mode.*`, `deco.dim.*`, `deco.relief.*`, `deco.clip.*`
    // reportées à P2.7c.
    'deco.target': '▸ PANNEAU CIBLE',
    'deco.target.front': 'Façade avant',
    'deco.target.back': 'Façade arrière',
    'deco.target.left': 'Côté gauche',
    'deco.target.right': 'Côté droit',
    'deco.target.roofL': 'Toit gauche',
    'deco.target.roofR': 'Toit droit',
    'deco.enable': 'Activer la décoration sur ce panneau',

    // DÉCOR P2.7b — file + status + warnings + shapes count.
    // Port v15 fidèle (src/translations.js:114-119, 141-151). Les clés
    // `deco.warn.*` (warnings mode vector/heightmap croisés) sont reportées
    // à P2.7c avec le toggle mode.
    'deco.file': '▸ FICHIER',
    'deco.file.load': 'Charger SVG / PNG / JPG',
    'deco.file.delete': 'Supprimer',
    'deco.status.empty': 'Aucun fichier chargé',
    'deco.status.emptyFor': 'Aucun fichier chargé — {panel}',
    'deco.error.load': 'Erreur de chargement : {message}',
    'deco.svg.malformed': 'SVG mal formé',
    'deco.svg.noShapes': 'Aucune forme exploitable dans le SVG',
    'deco.svg.parseError': 'Erreur parsing : {message}',
    'deco.svg.shapesCount': '{n} forme',
    'deco.svg.shapesCountPlural': '{n} formes',
    'deco.raster.size': 'raster {w}×{h}',

    // DÉCOR P2.7c — mode + dims + relief + clip + warnings.
    // Port v15 fidèle (src/translations.js:120-145).
    'deco.mode': '▸ MODE DE RENDU',
    'deco.mode.vector': 'Vectoriel',
    'deco.mode.vector.note': 'extrusion + bevel',
    'deco.mode.heightmap': 'Heightmap',
    'deco.mode.heightmap.note': 'relief depuis image',
    'deco.dims': '▸ DIMENSIONS',
    'deco.dim.width': 'Largeur',
    'deco.dim.height': 'Hauteur',
    'deco.dim.posX': 'Position X',
    'deco.dim.posY': 'Position Y',
    'deco.dim.rotation': 'Rotation image',
    'deco.relief': '▸ RELIEF',
    'deco.relief.depth': 'Profondeur',
    'deco.relief.bevel': 'Bevel',
    'deco.relief.bevel.hint': 'Bevel actif uniquement en mode vectoriel.',
    'deco.relief.invert': 'Inverser (heightmap)',
    'deco.relief.resolution': 'Résolution',
    'deco.relief.resolution.hint': 'Résolution en mode heightmap. 128 = très détaillé mais export STL long (3–10 s).',
    'deco.clip': '▸ CONFINEMENT',
    'deco.clip.enable': 'Clipper par la forme du panneau',
    'deco.clip.hint': "Coupe visuellement la déco qui dépasse du panneau ou recouvre le trou de porte. ⚠ N'affecte PAS l'export STL (géométrie complète exportée).",
    'deco.warn.vectorNoShapes': 'Le mode vectoriel nécessite un SVG avec des formes valides.',
    'deco.warn.imageNoVector': 'Les PNG/JPG ne supportent que le mode heightmap. Charge un SVG pour le mode vectoriel.',
    'deco.warn.svgInvalid': 'SVG invalide ({reason}) — seul le mode heightmap est disponible.',
    'deco.warn.parseFallback': '{warning} — vectoriel indisponible, bascule en heightmap.',
    'deco.warn.unavailable': 'Indisponible : pas de formes vectorielles (PNG/JPG ou SVG non reconnu)',
    // Erreur async resample resolution (P2.7c, pas de clé v15 équivalente).
    'deco.error.resample': 'Erreur de resample : {message}',

    // CALC — port v15 fidèle (src/translations.js:155-194). `calc.door.infoLine`
    // volontairement non portée : sert aux hints DIM en v15, hors scope CALC.
    'calc.volumes': '▸ VOLUMES',
    'calc.volume.ext': 'Volume extérieur',
    'calc.volume.int': 'Volume intérieur',
    'calc.volume.mat': 'Matériau (diff.)',
    'calc.surfaces': '▸ SURFACES',
    'calc.surface.total': 'Aire totale panneaux',
    'calc.surface.facades': 'Façades (×2)',
    'calc.surface.sides': 'Côtés (×2)',
    'calc.surface.bottom': 'Plancher',
    'calc.surface.roof': 'Toit G + D',
    'calc.cuts': '▸ LISTE DE COUPE',
    'calc.cuts.header.piece': 'Pièce',
    'calc.cuts.header.qty': 'Qté',
    'calc.cuts.header.dims': 'Dim. (mm)',
    'calc.cuts.facade': 'Façade',
    'calc.cuts.side': 'Côté',
    'calc.cuts.bottom': 'Plancher',
    'calc.cuts.roof': 'Toit',
    'calc.cuts.roofL': 'Toit G',
    'calc.cuts.roofR': 'Toit D',
    'calc.cuts.door': 'Porte',
    'calc.cuts.perch': 'Perchoir',
    'calc.cuts.note.miter': 'biseau {slope}°',
    'calc.cuts.note.ridgeT': '+T crête',
    'calc.cuts.note.full': 'plein',
    'calc.cuts.note.enclave': 'enclavé',
    'calc.cuts.note.pentagon': 'pentagone',
    'calc.cuts.note.flared': 'trapèze évasé',
    'calc.cuts.note.narrowed': 'trapèze rétréci',
    'calc.cuts.note.flaredBy': 'évasé {v}mm',
    'calc.cuts.note.narrowedBy': 'rétréci {v}mm',
    'calc.cuts.note.cylinder': 'cylindre ∅{d}',
    'calc.door.shape.round': 'ronde',
    'calc.door.shape.square': 'carrée',
    'calc.door.shape.pentagon': 'penta.',
    'calc.material': '▸ MATÉRIAU REQUIS',
    'calc.material.thickness': 'Épaisseur',
    'calc.material.pieces': 'Pièces totales',
    'calc.material.piecesCount': '{n} pièces',

    // PLAN — port v15 fidèle (src/translations.js:197-209). Reportées :
    //   - plan.legend  : HTML inline avec <br> (même politique que vue.controls.hint)
    //   - plan.export* : boutons export PNG/SVG reportés à P2.6 EXPORT
    //     (consolidation sous DownloadService avec STL/ZIP)
    'plan.panelSize': '▸ TAILLE DU PANNEAU',
    'plan.panelSize.custom': 'Personnalisé…',
    'plan.panelSize.bb': 'bouleau baltique',
    'plan.panelWidth': 'Largeur panneau',
    'plan.panelHeight': 'Hauteur panneau',
    'plan.panel': 'Panneau :',
    'plan.rotated': '(tourné 90°)',
    'plan.panelN': 'Panneau {n}',
    'plan.occupation': 'Occupation',
    'plan.panelCount': 'Nombre de panneaux :',
    'plan.meanOccupation': 'Occupation moyenne :',
    'plan.area': 'Aire pièces totale :',
    'plan.totalPanelArea': 'Aire panneaux totale :',
    'plan.overflowCount': 'Pièces hors panneau :',
    'plan.summary': '{n} panneau(x), occupation moyenne {occ}',
    'plan.noPanels': 'Aucun panneau — toutes les pièces sont trop grandes',
    'plan.overflow.title': '⚠ Pièces plus grandes que le panneau',

    // VIEWPORT — fallback rendu par ViewportErrorFallback quand le mount
    // Three.js throw (WebGL absent, context lost, etc.). Phrasing codex P2.5.5.
    'viewport.error.title': 'Aperçu 3D indisponible',
    'viewport.error.description': 'L\'aperçu 3D n\'a pas pu démarrer. WebGL n\'est peut-être pas disponible sur ce navigateur. Les autres onglets restent utilisables dans la barre latérale.',
    'viewport.error.hint': 'Vérifiez votre navigateur, désactivez les extensions bloquant WebGL, ou essayez un autre appareil.',

    // EXPORT — port v15 fidèle (src/translations.js:213-224) + clés déplacées
    // depuis PLAN (src/translations.js:207-208) + clé additive export.plan
    // (nouvelle pour grouper les exports plan avec les exports STL).
    // Divergences documentées :
    //   - export.stl.hint HTML inline (<br>) → éclaté en 3 clés .house/.zip/.dims
    //   - export.error.noJSZip omise (JSZip bundled en dep npm, plus de CDN check)
    //   - plan.export.png reportée à P3 (pas de raster dans P2.6)
    'export.stl': '▸ EXPORT STL (IMPRESSION 3D)',
    'export.stl.house': '⬇ Maison complète (.stl)',
    'export.stl.door': '⬇ Porte seule (.stl)',
    'export.stl.zip': '⬇ Panneaux séparés (.zip)',
    'export.stl.hint.house': 'Maison = tous panneaux fusionnés (B1).',
    'export.stl.hint.zip': 'ZIP = 1 fichier STL par panneau (A).',
    'export.stl.hint.dims': 'Dimensions en mm. Watertight par panneau.',
    'export.busy.house': 'Export maison…',
    'export.busy.door': 'Export porte…',
    'export.busy.zip': 'Export ZIP (chaque panneau)…',
    'export.error.nothing': 'Aucun panneau à exporter. Le modèle est-il bien affiché ?',
    'export.error.noDoor': 'Pas de panneau de porte à exporter. Activez « Créer le panneau de porte » dans l\'onglet DIM.',
    'export.error.generic': 'Erreur export : {message}',
    'export.plan': '▸ EXPORT PLAN DE COUPE',
    'plan.export.zip': '⬇ Plan de coupe (.zip, 1 SVG par panneau)',
    'export.busy.zip.plan': 'Export ZIP plan…',
    'export.png': '▸ EXPORT CAPTURE 3D',
    'png.export.3d': '⬇ Capture 3D (.png)',
    'export.busy.png.3d': 'Capture en cours…',
    'export.error.noViewport': 'Aperçu 3D pas encore prêt — attends quelques secondes puis réessaie.',
  },
  en: {
    // App
    'app.title': '⌂ BIRDHOUSE',
    'app.subtitle': 'BIRDHOUSE CALCULATOR',

    // Tabs
    'tab.dim': 'DIM.',
    'tab.vue': 'VIEW',
    'tab.deco': 'DECOR',
    'tab.calc': 'CALC',
    'tab.plan': 'PLAN',
    'tab.export': 'EXPORT',
    'tab.placeholder.construction': 'Tab under construction. Controls coming in later phases.',

    // Language / theme switcher
    'lang.label': 'Language',
    'lang.theme.toDark': 'Switch to dark mode',
    'lang.theme.toLight': 'Switch to light mode',

    // DIM — Body
    'dim.body': '▸ BODY (BOX)',
    'dim.width': 'Width (X)',
    'dim.height': 'Height (Y)',
    'dim.depth': 'Depth (Z)',
    'dim.taperX': 'Taper X',
    'dim.taperHint': 'Bottom width = top width + 2× taper. Positive = bottom wider (flared). Negative = bottom narrower. Roof stays at top width.',

    // DIM — Floor
    'dim.floor': '▸ FLOOR ASSEMBLY',
    'dim.floor.enclave': 'Embedded',
    'dim.floor.enclave.note': 'floor between walls',
    'dim.floor.pose': 'On-top',
    'dim.floor.pose.note': 'walls on floor',

    // DIM — Roof
    'dim.roof': '▸ ROOF',
    'dim.slope': 'Roof pitch',
    'dim.overhang': 'Overhang (rain)',

    // DIM — Ridge
    'dim.ridge': '▸ ROOF RIDGE JOINT',
    'dim.ridge.left': 'Left covers',
    'dim.ridge.left.note': '+T on left roof',
    'dim.ridge.right': 'Right covers',
    'dim.ridge.right.note': '+T on right roof',
    'dim.ridge.miter': 'Miter',
    'dim.ridge.miter.note': 'bevel at θ',

    // DIM — Material
    'dim.material': '▸ MATERIAL',
    'dim.thickness': 'Wall thickness',

    // DIM — Door
    'dim.door': '▸ ENTRY DOOR',
    'dim.door.none': 'None',
    'dim.door.round': 'Round',
    'dim.door.square': 'Square',
    'dim.door.pentagon': 'Penta.',
    'dim.door.face': 'Door face',
    'dim.door.face.front': 'Front',
    'dim.door.face.left': 'Left',
    'dim.door.face.right': 'Right',
    'dim.door.width': 'Door width',
    'dim.door.height': 'Door height',
    'dim.door.posX': 'Horiz. position',
    'dim.door.posY': 'Vert. position',
    'dim.door.createPanel': 'Create door panel',
    'dim.door.adjust': 'Adjustment',
    'dim.door.adjust.hint': '100% = same size as hole',
    'dim.door.followTaper': 'Door sides follow taper',
    'dim.door.followTaper.hint': 'Pentagon only. Door sides slant at wall angle.',

    // DIM — Accessories (group header)
    'dim.accessories': '▸ ACCESSORIES',

    // DIM — Perch
    'dim.perch': '▸ PERCH',
    'dim.perch.add': 'Add perch',
    'dim.perch.diameter': 'Diameter',
    'dim.perch.length': 'Length',
    'dim.perch.offset': 'Below door',

    // DIM — Hang (suspension holes)
    'dim.hang': '▸ HANGING',
    'dim.hang.add': 'Add suspension holes (roof overhang)',
    'dim.hang.posY': 'Distance from edge',
    'dim.hang.offsetX': 'Distance from ridge',
    'dim.hang.diameter': 'Hole diameter',

    // VUE — port v15 fidèle (src/translations.js:318-328). `vue.controls.hint`
    // volontairement reporté (voir commentaire FR).
    'vue.mode': '▸ DISPLAY MODE',
    'vue.mode.solid': 'Solid',
    'vue.mode.wireframe': 'Wireframe',
    'vue.mode.xray': 'X-Ray',
    'vue.mode.edges': 'Edges',
    'vue.explode': '▸ EXPLODED VIEW',
    'vue.explode.label': 'Panel separation',
    'vue.palette': '▸ MODEL COLORS',
    'vue.palette.wood': 'Natural wood',
    'vue.palette.wood-contrast': 'Wood contrast',
    'vue.palette.colorful': 'Colorful',
    'vue.palette.mono': 'Monochrome',
    'vue.clip': '▸ SECTION CUTS',
    'vue.clip.x': 'X cut',
    'vue.clip.y': 'Y cut',
    'vue.clip.z': 'Z cut',

    // DECOR P2.7a — faithful v15 port (src/translations.js:331-337, 340).
    // `deco.mode.*`, `deco.dim.*`, `deco.relief.*`, `deco.clip.*` deferred
    // to P2.7c.
    'deco.target': '▸ TARGET PANEL',
    'deco.target.front': 'Front',
    'deco.target.back': 'Back',
    'deco.target.left': 'Left side',
    'deco.target.right': 'Right side',
    'deco.target.roofL': 'Left roof',
    'deco.target.roofR': 'Right roof',
    'deco.enable': 'Enable decoration on this panel',

    // DECOR P2.7b — file + status + warnings + shapes count.
    // Faithful v15 port (src/translations.js:338-343, 365-375). `deco.warn.*`
    // (cross mode vector/heightmap warnings) deferred to P2.7c.
    'deco.file': '▸ FILE',
    'deco.file.load': 'Load SVG / PNG / JPG',
    'deco.file.delete': 'Delete',
    'deco.status.empty': 'No file loaded',
    'deco.status.emptyFor': 'No file loaded — {panel}',
    'deco.error.load': 'Load error: {message}',
    'deco.svg.malformed': 'Malformed SVG',
    'deco.svg.noShapes': 'No usable shapes in the SVG',
    'deco.svg.parseError': 'Parse error: {message}',
    'deco.svg.shapesCount': '{n} shape',
    'deco.svg.shapesCountPlural': '{n} shapes',
    'deco.raster.size': 'raster {w}×{h}',

    // DECOR P2.7c — mode + dims + relief + clip + warnings.
    // Faithful v15 port (src/translations.js:344-369).
    'deco.mode': '▸ RENDER MODE',
    'deco.mode.vector': 'Vector',
    'deco.mode.vector.note': 'extrude + bevel',
    'deco.mode.heightmap': 'Heightmap',
    'deco.mode.heightmap.note': 'relief from image',
    'deco.dims': '▸ DIMENSIONS',
    'deco.dim.width': 'Width',
    'deco.dim.height': 'Height',
    'deco.dim.posX': 'X position',
    'deco.dim.posY': 'Y position',
    'deco.dim.rotation': 'Image rotation',
    'deco.relief': '▸ RELIEF',
    'deco.relief.depth': 'Depth',
    'deco.relief.bevel': 'Bevel',
    'deco.relief.bevel.hint': 'Bevel only active in vector mode.',
    'deco.relief.invert': 'Invert (heightmap)',
    'deco.relief.resolution': 'Resolution',
    'deco.relief.resolution.hint': 'Resolution in heightmap mode. 128 = very detailed but slow STL export (3–10 s).',
    'deco.clip': '▸ CLIPPING',
    'deco.clip.enable': 'Clip to panel shape',
    'deco.clip.hint': 'Visually cuts decoration overflowing the panel or covering the door hole. ⚠ Does NOT affect STL export (full geometry exported).',
    'deco.warn.vectorNoShapes': 'Vector mode requires an SVG with valid shapes.',
    'deco.warn.imageNoVector': 'PNG/JPG only support heightmap mode. Load an SVG for vector mode.',
    'deco.warn.svgInvalid': 'Invalid SVG ({reason}) — only heightmap mode available.',
    'deco.warn.parseFallback': '{warning} — vector unavailable, falling back to heightmap.',
    'deco.warn.unavailable': 'Unavailable: no vector shapes (PNG/JPG or unrecognized SVG)',
    // Async resample error (P2.7c, no v15 equivalent key).
    'deco.error.resample': 'Resample error: {message}',

    // CALC — faithful v15 port (src/translations.js:378-417). `calc.door.infoLine`
    // deliberately not ported (see FR comment).
    'calc.volumes': '▸ VOLUMES',
    'calc.volume.ext': 'Exterior volume',
    'calc.volume.int': 'Interior volume',
    'calc.volume.mat': 'Material (diff.)',
    'calc.surfaces': '▸ SURFACES',
    'calc.surface.total': 'Total panel area',
    'calc.surface.facades': 'Facades (×2)',
    'calc.surface.sides': 'Sides (×2)',
    'calc.surface.bottom': 'Floor',
    'calc.surface.roof': 'Roof L + R',
    'calc.cuts': '▸ CUT LIST',
    'calc.cuts.header.piece': 'Piece',
    'calc.cuts.header.qty': 'Qty',
    'calc.cuts.header.dims': 'Dim. (mm)',
    'calc.cuts.facade': 'Facade',
    'calc.cuts.side': 'Side',
    'calc.cuts.bottom': 'Floor',
    'calc.cuts.roof': 'Roof',
    'calc.cuts.roofL': 'Roof L',
    'calc.cuts.roofR': 'Roof R',
    'calc.cuts.door': 'Door',
    'calc.cuts.perch': 'Perch',
    'calc.cuts.note.miter': 'bevel {slope}°',
    'calc.cuts.note.ridgeT': '+T ridge',
    'calc.cuts.note.full': 'full',
    'calc.cuts.note.enclave': 'inset',
    'calc.cuts.note.pentagon': 'pentagon',
    'calc.cuts.note.flared': 'flared trapezoid',
    'calc.cuts.note.narrowed': 'narrowed trapezoid',
    'calc.cuts.note.flaredBy': 'flared {v}mm',
    'calc.cuts.note.narrowedBy': 'narrowed {v}mm',
    'calc.cuts.note.cylinder': 'cylinder ∅{d}',
    'calc.door.shape.round': 'round',
    'calc.door.shape.square': 'square',
    'calc.door.shape.pentagon': 'penta.',
    'calc.material': '▸ MATERIAL REQUIRED',
    'calc.material.thickness': 'Thickness',
    'calc.material.pieces': 'Total pieces',
    'calc.material.piecesCount': '{n} pieces',

    // PLAN — faithful v15 port (src/translations.js:419-431). Deferred keys
    // identical to FR (see FR comment).
    'plan.panelSize': '▸ SHEET SIZE',
    'plan.panelSize.custom': 'Custom…',
    'plan.panelSize.bb': 'baltic birch',
    'plan.panelWidth': 'Sheet width',
    'plan.panelHeight': 'Sheet height',
    'plan.panel': 'Sheet:',
    'plan.rotated': '(rotated 90°)',
    'plan.panelN': 'Sheet {n}',
    'plan.occupation': 'Occupation',
    'plan.panelCount': 'Sheet count:',
    'plan.meanOccupation': 'Mean occupation:',
    'plan.area': 'Total pieces area:',
    'plan.totalPanelArea': 'Total sheet area:',
    'plan.overflowCount': 'Oversized pieces:',
    'plan.summary': '{n} sheet(s), mean occupation {occ}',
    'plan.noPanels': 'No sheet — all pieces are too large',
    'plan.overflow.title': '⚠ Pieces larger than the sheet',

    // VIEWPORT — fallback rendered by ViewportErrorFallback when the
    // Three.js mount throws (WebGL absent, context lost, etc.).
    'viewport.error.title': '3D preview unavailable',
    'viewport.error.description': 'The 3D preview could not start. WebGL may not be available in this browser. The other tabs remain available in the sidebar.',
    'viewport.error.hint': 'Check your browser, disable WebGL-blocking extensions, or try another device.',

    // EXPORT — faithful v15 port (src/translations.js:434-445) + keys moved
    // from PLAN (src/translations.js:429-430) + additive export.plan key.
    // See FR comment for divergences.
    'export.stl': '▸ STL EXPORT (3D PRINTING)',
    'export.stl.house': '⬇ Complete house (.stl)',
    'export.stl.door': '⬇ Door only (.stl)',
    'export.stl.zip': '⬇ Separate panels (.zip)',
    'export.stl.hint.house': 'House = all panels merged (B1).',
    'export.stl.hint.zip': 'ZIP = 1 STL file per panel (A).',
    'export.stl.hint.dims': 'Dimensions in mm. Watertight per panel.',
    'export.busy.house': 'Exporting house…',
    'export.busy.door': 'Exporting door…',
    'export.busy.zip': 'Exporting ZIP (each panel)…',
    'export.error.nothing': 'No panels to export. Is the model displayed?',
    'export.error.noDoor': 'No door piece to export. Enable "Create door piece" in the DIM tab.',
    'export.error.generic': 'Export error: {message}',
    'export.plan': '▸ CUT PLAN EXPORT',
    'plan.export.zip': '⬇ Cut plan (.zip, 1 SVG per sheet)',
    'export.busy.zip.plan': 'Exporting ZIP plan…',
    'export.png': '▸ 3D CAPTURE EXPORT',
    'png.export.3d': '⬇ 3D capture (.png)',
    'export.busy.png.3d': 'Capturing…',
    'export.error.noViewport': '3D preview not ready yet — wait a few seconds and retry.',
  },
};
