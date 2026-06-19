import init, {
  default_params_json,
  render_app_html,
  scene_meshes_json,
  export_house_stl,
  export_house_obj,
  export_door_stl,
  export_wall_mount_stl,
  export_panels_zip,
  mesh_report_json,
  plan_preview_svg,
} from '../wasm/pkg/wasm.js?v=20260619-intact-stl-decor-import';
import * as THREE from './vendor/three.module.min.js';

const APP_BUILD_ID = '20260619-stl-viewer-smooth-orbit';
const root = document.getElementById('app');
const LANG_KEY = 'nichoir-lang';
const THEME_KEY = 'nichoir-theme';
const EXPORT_APP_ID = 'nichoir';

function isLocalHostname(hostname) {
  const normalized = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function detectPhpBase() {
  if (window.NICHOIR_PHP_BASE) return window.NICHOIR_PHP_BASE;
  const queryBase = new URLSearchParams(window.location.search).get('php_base');
  if (queryBase && isLocalHostname(window.location.hostname)) {
    try {
      const parsed = new URL(queryBase);
      if (['http:', 'https:'].includes(parsed.protocol) && isLocalHostname(parsed.hostname)) {
        return parsed.origin;
      }
    } catch (_) {
      // Fall through to same-origin links when the local dev base is malformed.
    }
  }
  if (isLocalHostname(window.location.hostname) && window.location.port === '8016') {
    return `${window.location.protocol}//${window.location.hostname}:8021`;
  }
  return window.location.origin;
}

const PHP_BASE = detectPhpBase();
localStorage.removeItem('nichoir-auth-token');
const MESH_REPORT_STORAGE_KEY = 'nichoir-last-mesh-report';
const MAX_DECO_FILE_BYTES = 2 * 1024 * 1024;
const MAX_DECO_STL_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DECO_STL_TRIANGLES_HINT = 120_000;
const DECO_SIZE_MIN_MM = 5;
const DECO_SIZE_MAX_MM = 400;
const DECO_TARGET_KEYS = ['front', 'back', 'left', 'right', 'roofL', 'roofR'];
const DECO_ACCEPT = '.svg,image/*,.stl';
const DECO_RASTER_EXTENSIONS = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  bmp: 'png',
  ico: 'png',
  tif: 'png',
  tiff: 'png',
  avif: 'png',
};
const DECO_RASTER_MIME_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
let decorLibraryItemsById = new Map();
const DECO_PREVIEW_MIME_TYPES = {
  svg: 'image/png',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};
const CLIENT_LOG_LIMIT = 10;
const CLIENT_LOG_WINDOW_MS = 60 * 1000;
const FORBIDDEN_SVG_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
];
const EXPORT_COSTS = {
  svg: 1,
  png: 1,
  pdf: 2,
  stl: 3,
  zip: 5,
};

function debugStlLog(message, details = {}) {
  console.log(`[nichoir stl] ${message}`, details);
}

const I18N = {
  fr: {
    loading_title: 'Nichoir WASM',
    loading_message: 'Chargement du module WebAssembly...',
    theme_light: 'Clair',
    theme_dark: 'Sombre',
    theme_to_light: 'Passer au mode clair',
    theme_to_dark: 'Passer au mode sombre',
    account_loading: 'Chargement...',
    account_connected: 'Connecte',
    account_session_expired: 'Session expiree',
    account_disconnected: 'Non connecte',
    activation_unavailable: 'Activation indisponible. SMTP doit etre configure dans Admin.',
    activation_failed: 'Activation refusee. Verifie le code sur le site.',
    too_many_requests: 'Trop de tentatives. Attends quelques minutes.',
    invalid_credentials: 'Connexion refusee. Verifie le mot de passe ou active le compte sur le site.',
    no_ticket: 'Aucun ticket.',
    open: 'Ouvrir',
    close: 'Fermer',
    reopen: 'Reouvrir',
    no_message: 'Aucun message.',
    support: 'Support',
    client: 'Client',
    tickets_error: 'Tickets: {error}',
    ticket_error: 'Ticket: {error}',
    invalid_session: 'Session invalide: {error}',
    account_error: 'Compte: {error}',
    account_logged_out: 'Compte deconnecte.',
    authorizing_export: 'Autorisation serveur pour {filename}...',
    login_required_download: 'Connexion requise avant ce telechargement. Ouvre Compte et connecte-toi.',
    insufficient_credits: 'Credits insuffisants pour ce telechargement.',
    credit_unit_one: 'credit',
    credit_unit_many: 'credits',
    export_gate_eyebrow: 'Telechargement premium',
    export_gate_guest_title: 'Connecte ton compte pour recuperer ce fichier',
    export_gate_guest_body: 'Garde ton modele, active ton compte, puis choisis un pack de credits quand tu veux exporter STL, PDF, images ou ZIP panneaux.',
    export_gate_guest_marketing: 'Les credits sont debites seulement au telechargement. Tu peux comparer les packs avant de payer.',
    export_gate_credit_title: 'Credits insuffisants',
    export_gate_credit_body: 'Ce telechargement demande {cost}. Ton solde actuel est {credits}. Choisis un pack de credits pour continuer.',
    export_gate_credit_marketing: 'Un pack garde tes prochains exports prets pour les STL, plans PDF et ZIP panneaux.',
    export_gate_bonus_title: 'Activer le bonus gratuit?',
    export_gate_bonus_body: 'Il te reste {credits}. Ce telechargement coute {cost}. Nichoir peut ajouter {bonus} bonus pour finaliser ce fichier.',
    export_gate_bonus_note: 'Le bonus s applique seulement a ce telechargement; le journal credits garde le mouvement.',
    export_gate_buy_credits: 'Acheter des credits',
    export_gate_sign_in: 'Se connecter',
    export_gate_activate_bonus: 'Activer le bonus et telecharger',
    export_gate_cancel: 'Annuler',
    export_gate_close: 'Fermer',
    authorization_denied: 'Autorisation refusee: {code}',
    remaining_credits: 'Credits restants: {count}.',
    file_created_bytes: 'Fichier cree: {filename} ({size} octets). Cout: {cost} credits.{suffix}',
    file_created_chars: 'Fichier cree: {filename} ({size} caracteres). Cout: {cost} credits.{suffix}',
    file_created_simple_bytes: 'Fichier cree: {filename} ({size} octets)',
    file_created_simple_chars: 'Fichier cree: {filename} ({size} caracteres)',
    export_error: 'Erreur export: {error}',
    calculations_title: 'NICHOIR - Calculs',
    generated_at: 'Genere le {date}',
    calculations_section: 'CALCULS',
    pieces_section: 'PIECES',
    quantity_short: 'qte',
    plan_piece_title: 'NICHOIR - Piece {index}: {name}',
    identification: 'IDENTIFICATION',
    name: 'Nom',
    quantity: 'Quantite',
    dimensions: 'Dimensions',
    piece_cuts: 'Coupes / angles de cette piece',
    default_piece_cut: 'coupe droite / aucun angle special',
    model_angles: 'ANGLES ET COUPES DU MODELE',
    cut_plan_params: 'PARAMETRES DU PLAN DE COUPE',
    fabrication_note: 'NOTE FABRICATION',
    fabrication_note_body: 'Verifier le sens de pose, les chants biseautes et la crete avant coupe finale.',
    cut_plan_title: 'NICHOIR - Plan de coupe',
    no_piece_found: 'Aucune piece trouvee dans la table de calcul.',
    front_façade: 'Facade avant',
    back_façade: 'Facade arriere',
    left_side: 'Cote gauche',
    right_side: 'Cote droit',
    left_roof: 'Toit gauche',
    right_roof: 'Toit droit',
    indicative_diagram: 'Schema indicatif de la piece. Voir dimensions exactes et coupes a droite.',
    cuts_and_angles: 'Coupes et angles',
    model_angles_short: 'Angles du modele',
    pdf_image_error: 'Impossible de convertir le plan SVG en image PDF',
    piece_card_title: 'Piece {index}: {name}',
    plan_pdf_empty: 'PDF plan impossible: aucun plan SVG genere.',
    exploded_assembly: 'Assemblage eclate',
    file_created_named: 'Fichier cree: {filename}',
    plan_png_empty: 'PNG plan impossible: aucun plan SVG genere.',
    mesh_report_invalid: 'Rapport mesh impossible: reponse WASM invalide.',
    mesh_report_created: 'Rapport cree: maison {triangles} triangles, {degenerate} degeneres, ZIP {bytes} octets',
    mesh_report_error: 'Erreur rapport mesh: {error}',
    ticket_created: 'Ticket cree.',
    ticket_denied: 'Ticket refuse: {error}',
    ticket_reply_sent: 'Reponse ticket envoyee.',
    ticket_reply_denied: 'Reponse refusee: {error}',
    ticket_reopened: 'Ticket rouvert.',
    ticket_closed: 'Ticket ferme.',
    ticket_status_denied: 'Statut ticket refuse: {error}',
    pricing_info: 'Credits: le serveur PHP confirme le cout reel avant chaque telechargement premium.',
    decor_load_supported: 'Decor: charge un SVG, STL ou une image prise en charge par ton navigateur.',
    decor_too_large: 'Decor: fichier trop lourd. Limite actuelle: 2 Mo.',
    decor_stl_too_large: 'Decor: STL trop lourd. Limite actuelle: 25 Mo.',
    decor_processing: 'Decor: conversion en heightmap...',
    decor_stl_processing: 'Decor: chargement du STL...',
    decor_svg_heightmap: 'Decor: SVG rasterise en heightmap et envoye au WASM.',
    decor_image_heightmap: 'Decor: image convertie en heightmap et envoyee au WASM.',
    decor_stl_loaded: 'Decor: STL charge et attache au panneau cible dans le mesh local.',
    decor_stl_export_omitted: 'Decor: STL visible en apercu, mais exclu des exports car il devient ouvert ou non-manifold apres clipping.',
    decor_heightmap_failed: 'Decor: conversion heightmap impossible ({error}).',
    decor_stl_failed: 'Decor: STL impossible a charger ({error}).',
    decor_read_failed: 'Decor: impossible de lire le fichier.',
    decor_upload_first: 'Decor: charge un fichier avant d activer le relief.',
    decor_preview_empty: 'Apercu apres chargement',
    decor_stl_preview: 'STL importe',
    decor_preview_alt: 'Apercu du decor charge',
    decor_library_title: 'Librairie de decors',
    decor_library_body: 'Telecharge un fichier de la librairie avec credits, puis importe le STL telecharge dans la zone ci-dessus.',
    decor_library_open: 'Ouvrir librairie',
    decor_library_refresh: 'Actualiser',
    decor_library_download: 'Telecharger',
    decor_library_preview: 'Apercu 3D',
    decor_library_preview_title: 'Apercu avant telechargement',
    decor_library_preview_loading: 'Chargement de l apercu 3D...',
    decor_library_preview_close: 'Fermer',
    decor_library_view_iso: 'Iso',
    decor_library_view_front: 'Face',
    decor_library_view_top: 'Haut',
    decor_library_view_side: 'Cote',
    decor_library_rotate: 'Tourner',
    decor_library_horizon: 'Horizon',
    decor_library_move: 'Deplacer',
    decor_library_zoom_in: '+',
    decor_library_zoom_out: '-',
    decor_library_fit: 'Fit',
    decor_library_reset: 'Reset',
    decor_library_empty: 'Aucun decor actif dans la librairie.',
    decor_library_loading: 'Chargement de la librairie...',
    decor_library_error: 'Librairie: {error}',
    decor_library_ready: 'Librairie: {count} fichier(s) disponible(s).',
    decor_library_started: 'Telechargement lance. Importe ensuite le fichier depuis ton ordinateur.',
    decor_library_insufficient: 'Credits insuffisants pour ce decor.',
    export_house_empty: 'Export maison vide: le modele n a genere aucun triangle.',
    export_door_empty: 'Pas de porte STL: choisis une porte et active "Creer le panneau de porte".',
    export_wall_mount_empty: 'Pas de STL fixation murale: active "Fixation murale" dans Dimensions.',
    export_panels_empty: 'Export panneaux vide: aucune piece n a ete generee.',
    export_plan_empty: 'Export plan impossible: aucun SVG genere.',
    export_obj_empty: 'Export OBJ vide: le modele n a genere aucun triangle.',
    app_unavailable: 'Application indisponible. Recharge la page.',
    viewer_unavailable: 'Apercu 3D indisponible sur ce navigateur.',
    exploded_mesh_missing: 'Image eclatee impossible: aucun mesh genere.',
    ticket_state_open: 'ouvert',
    ticket_state_closed: 'ferme',
    ticket_priority_normal: 'normal',
    ticket_priority_urgent: 'urgent',
    plan_none: 'aucun',
    subscription_active: 'actif',
    subscription_canceled: 'annule',
    subscription_cancelled: 'annule',
    subscription_past_due: 'paiement en retard',
    subscription_unpaid: 'impaye',
    subscription_trialing: 'essai',
    subscription_incomplete: 'incomplet',
    subscription_suspended: 'suspendu',
    file_house_stl: 'nichoir_maison.stl',
    file_door_stl: 'nichoir_porte.stl',
    file_wall_mount_stl: 'nichoir_bloc_fixation_mur.stl',
    file_panels_zip: 'nichoir_panneaux.zip',
    file_plan_svg: 'nichoir_plan.svg',
    file_plan_png: 'nichoir_plan_de_coupe.png',
    file_explosion_png: 'nichoir_assemblage_eclate.png',
    file_plan_pdf: 'nichoir_plan_de_coupe.pdf',
    file_debug_obj: 'nichoir_maison_debug.obj',
    file_calcs_pdf: 'nichoir_calculs.pdf',
    file_mesh_report_json: 'nichoir_mesh_report.json',
  },
  en: {
    loading_title: 'Nichoir WASM',
    loading_message: 'Loading WebAssembly module...',
    theme_light: 'Light',
    theme_dark: 'Dark',
    theme_to_light: 'Switch to light mode',
    theme_to_dark: 'Switch to dark mode',
    account_loading: 'Loading...',
    account_connected: 'Connected',
    account_session_expired: 'Session expired',
    account_disconnected: 'Signed out',
    activation_unavailable: 'Activation unavailable. SMTP must be configured in Admin.',
    activation_failed: 'Activation denied. Verify the code on the site.',
    too_many_requests: 'Too many attempts. Wait a few minutes.',
    invalid_credentials: 'Login denied. Check the password or activate the account on the site.',
    no_ticket: 'No tickets.',
    open: 'Open',
    close: 'Close',
    reopen: 'Reopen',
    no_message: 'No messages.',
    support: 'Support',
    client: 'Client',
    tickets_error: 'Tickets: {error}',
    ticket_error: 'Ticket: {error}',
    invalid_session: 'Invalid session: {error}',
    account_error: 'Account: {error}',
    account_logged_out: 'Account signed out.',
    authorizing_export: 'Server authorization for {filename}...',
    login_required_download: 'Login required before this download. Open Account and sign in.',
    insufficient_credits: 'Insufficient credits for this download.',
    credit_unit_one: 'credit',
    credit_unit_many: 'credits',
    export_gate_eyebrow: 'Premium download',
    export_gate_guest_title: 'Connect your account to get this file',
    export_gate_guest_body: 'Keep your model, activate your account, then choose a credit pack when you are ready to export STL, PDF, images, or panel ZIPs.',
    export_gate_guest_marketing: 'Credits are debited only when you download. You can compare packs before paying.',
    export_gate_credit_title: 'Not enough credits',
    export_gate_credit_body: 'This download requires {cost}. Your current balance is {credits}. Choose a credit pack to continue.',
    export_gate_credit_marketing: 'A pack keeps your next STL, PDF plan, and panel ZIP exports ready.',
    export_gate_bonus_title: 'Activate the free bonus?',
    export_gate_bonus_body: 'You have {credits} left. This download costs {cost}. Nichoir can add {bonus} as a bonus to complete this file.',
    export_gate_bonus_note: 'The bonus applies only to this download; the credit ledger records the movement.',
    export_gate_buy_credits: 'Buy credits',
    export_gate_sign_in: 'Sign in',
    export_gate_activate_bonus: 'Activate bonus and download',
    export_gate_cancel: 'Cancel',
    export_gate_close: 'Close',
    authorization_denied: 'Authorization denied: {code}',
    remaining_credits: 'Credits left: {count}.',
    file_created_bytes: 'File created: {filename} ({size} bytes). Cost: {cost} credits.{suffix}',
    file_created_chars: 'File created: {filename} ({size} characters). Cost: {cost} credits.{suffix}',
    file_created_simple_bytes: 'File created: {filename} ({size} bytes)',
    file_created_simple_chars: 'File created: {filename} ({size} characters)',
    export_error: 'Export error: {error}',
    calculations_title: 'NICHOIR - Calculations',
    generated_at: 'Generated on {date}',
    calculations_section: 'CALCULATIONS',
    pieces_section: 'PIECES',
    quantity_short: 'qty',
    plan_piece_title: 'NICHOIR - Piece {index}: {name}',
    identification: 'IDENTIFICATION',
    name: 'Name',
    quantity: 'Quantity',
    dimensions: 'Dimensions',
    piece_cuts: 'Cuts / angles for this piece',
    default_piece_cut: 'straight cut / no special angle',
    model_angles: 'MODEL ANGLES AND CUTS',
    cut_plan_params: 'CUT PLAN PARAMETERS',
    fabrication_note: 'FABRICATION NOTE',
    fabrication_note_body: 'Verify orientation, beveled edges, and ridge direction before final cutting.',
    cut_plan_title: 'NICHOIR - Cut plan',
    no_piece_found: 'No piece found in the calculation table.',
    front_façade: 'Front facade',
    back_façade: 'Back facade',
    left_side: 'Left side',
    right_side: 'Right side',
    left_roof: 'Left roof',
    right_roof: 'Right roof',
    indicative_diagram: 'Indicative piece diagram. See exact dimensions and cuts on the right.',
    cuts_and_angles: 'Cuts and angles',
    model_angles_short: 'Model angles',
    pdf_image_error: 'Unable to convert SVG plan into a PDF image',
    piece_card_title: 'Piece {index}: {name}',
    plan_pdf_empty: 'Plan PDF unavailable: no SVG plan was generated.',
    exploded_assembly: 'Exploded assembly',
    file_created_named: 'File created: {filename}',
    plan_png_empty: 'Plan PNG unavailable: no SVG plan was generated.',
    mesh_report_invalid: 'Mesh report unavailable: invalid WASM response.',
    mesh_report_created: 'Report created: house {triangles} triangles, {degenerate} degenerate, ZIP {bytes} bytes',
    mesh_report_error: 'Mesh report error: {error}',
    ticket_created: 'Ticket created.',
    ticket_denied: 'Ticket denied: {error}',
    ticket_reply_sent: 'Ticket reply sent.',
    ticket_reply_denied: 'Reply denied: {error}',
    ticket_reopened: 'Ticket reopened.',
    ticket_closed: 'Ticket closed.',
    ticket_status_denied: 'Ticket status denied: {error}',
    pricing_info: 'Credits: the PHP server confirms the real cost before each premium download.',
    decor_load_supported: 'Decor: load an SVG, STL, or image supported by your browser.',
    decor_too_large: 'Decor: file too large. Current limit: 2 MB.',
    decor_stl_too_large: 'Decor: STL file too large. Current limit: 25 MB.',
    decor_processing: 'Decor: converting to heightmap...',
    decor_stl_processing: 'Decor: loading STL...',
    decor_svg_heightmap: 'Decor: SVG rasterized to a heightmap and sent to WASM.',
    decor_image_heightmap: 'Decor: image converted to heightmap and sent to WASM.',
    decor_stl_loaded: 'Decor: STL loaded and attached to the selected panel in the local mesh.',
    decor_stl_export_omitted: 'Decor: STL is visible in preview, but excluded from exports because it becomes open or non-manifold after clipping.',
    decor_heightmap_failed: 'Decor: heightmap conversion failed ({error}).',
    decor_stl_failed: 'Decor: unable to load STL ({error}).',
    decor_read_failed: 'Decor: unable to read the file.',
    decor_upload_first: 'Decor: load a file before enabling relief.',
    decor_preview_empty: 'Preview after upload',
    decor_stl_preview: 'Imported STL',
    decor_preview_alt: 'Uploaded decoration preview',
    decor_library_title: 'Decor library',
    decor_library_body: 'Download a library file with credits, then import the downloaded STL in the drop zone above.',
    decor_library_open: 'Open library',
    decor_library_refresh: 'Refresh',
    decor_library_download: 'Download',
    decor_library_preview: '3D preview',
    decor_library_preview_title: 'Preview before download',
    decor_library_preview_loading: 'Loading 3D preview...',
    decor_library_preview_close: 'Close',
    decor_library_view_iso: 'Iso',
    decor_library_view_front: 'Front',
    decor_library_view_top: 'Top',
    decor_library_view_side: 'Side',
    decor_library_rotate: 'Rotate',
    decor_library_horizon: 'Horizon',
    decor_library_move: 'Move',
    decor_library_zoom_in: '+',
    decor_library_zoom_out: '-',
    decor_library_fit: 'Fit',
    decor_library_reset: 'Reset',
    decor_library_empty: 'No active decor file is in the library.',
    decor_library_loading: 'Loading library...',
    decor_library_error: 'Library: {error}',
    decor_library_ready: 'Library: {count} file(s) available.',
    decor_library_started: 'Download started. Then import the file from your computer.',
    decor_library_insufficient: 'Not enough credits for this decor.',
    export_house_empty: 'House export is empty: the model generated no triangles.',
    export_door_empty: 'No STL door: choose a door and enable "Create door panel".',
    export_wall_mount_empty: 'No wall mount STL: enable "Wall mount" in Dimensions.',
    export_panels_empty: 'Panel export is empty: no part was generated.',
    export_plan_empty: 'Plan export unavailable: no SVG was generated.',
    export_obj_empty: 'OBJ export is empty: the model generated no triangles.',
    app_unavailable: 'Application unavailable. Reload the page.',
    viewer_unavailable: '3D preview unavailable in this browser.',
    exploded_mesh_missing: 'Exploded image unavailable: no mesh was generated.',
    ticket_state_open: 'open',
    ticket_state_closed: 'closed',
    ticket_priority_normal: 'normal',
    ticket_priority_urgent: 'urgent',
    plan_none: 'none',
    subscription_active: 'active',
    subscription_canceled: 'canceled',
    subscription_cancelled: 'cancelled',
    subscription_past_due: 'past due',
    subscription_unpaid: 'unpaid',
    subscription_trialing: 'trial',
    subscription_incomplete: 'incomplete',
    subscription_suspended: 'suspended',
    file_house_stl: 'nichoir_house.stl',
    file_door_stl: 'nichoir_door.stl',
    file_wall_mount_stl: 'nichoir_wall_mount_block.stl',
    file_panels_zip: 'nichoir_panels.zip',
    file_plan_svg: 'nichoir_cut_plan.svg',
    file_plan_png: 'nichoir_cut_plan.png',
    file_explosion_png: 'nichoir_exploded_view.png',
    file_plan_pdf: 'nichoir_cut_plan.pdf',
    file_debug_obj: 'nichoir_house_debug.obj',
    file_calcs_pdf: 'nichoir_calculations.pdf',
    file_mesh_report_json: 'nichoir_mesh_report.json',
  },
};

function warnI18nParity() {
  const baseKeys = Object.keys(I18N.fr || {});
  Object.entries(I18N).forEach(([lang, table]) => {
    const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(table, key));
    if (missing.length) {
      console.warn(`Missing ${lang} i18n keys: ${missing.join(', ')}`);
    }
  });
}

warnI18nParity();

let params = null;
let frameId = null;
let activeTab = 'dim';
let viewerState = null;
let lastAccountFocus = null;
let accountState = {
  user: null,
  loading: false,
  error: '',
};
let adminSession = {
  checked: false,
  admin: false,
};
let accountTickets = [];
let accountTicketDetail = null;
let selectedAccountTicketId = null;
let clientLogTimestamps = [];
let modalWasOpen = false;
let theme = localStorage.getItem(THEME_KEY)
  || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

class ApiError extends Error {
  constructor(message, payload = {}, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.payload = payload;
    this.status = status;
  }
}

function normalizeLang(lang) {
  return ['fr', 'en'].includes(lang) ? lang : 'fr';
}

function detectInitialLanguage() {
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang === 'fr' || urlLang === 'en') return urlLang;
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

function currentLang() {
  return normalizeLang(params?.lang || localStorage.getItem(LANG_KEY) || 'fr');
}

function locale() {
  return currentLang() === 'en' ? 'en-CA' : 'fr-CA';
}

function tr(key, vars = {}) {
  const lang = currentLang();
  const table = I18N[lang] || I18N.fr;
  const fallback = I18N.fr[key] || key;
  return String(table[key] || fallback).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(locale(), options).format(value);
}

function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(locale());
}

function formatDisplayDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateTime(date);
}

function formatCountText(value) {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1048576) return `${formatNumber(value / 1048576, { maximumFractionDigits: 1 })} Mo`;
  if (value >= 1024) return `${formatCountText(value / 1024)} Ko`;
  return `${formatCountText(value)} o`;
}

function formatCreditText(value) {
  const count = Number(value) || 0;
  const unit = Math.abs(count) === 1 ? tr('credit_unit_one') : tr('credit_unit_many');
  return `${formatCountText(count)} ${unit}`;
}

function setDocumentLanguage() {
  document.documentElement.lang = currentLang();
  document.title = tr('loading_title');
}

function exportFilename(key) {
  return tr(`file_${key}`);
}

function applyTheme() {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-action="theme-toggle"]').forEach((button) => {
    const label = isDark ? tr('theme_dark') : tr('theme_light');
    const icon = isDark ? '☾' : '☼';
    const labelNode = button.querySelector('[data-theme-label]');
    const iconNode = button.querySelector('[data-theme-icon]');
    if (labelNode) {
      labelNode.textContent = label;
    } else {
      button.textContent = label;
    }
    if (iconNode) {
      iconNode.textContent = icon;
    }
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? tr('theme_to_light') : tr('theme_to_dark'));
  });
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  renderViewer();
}

function initialCameraState() {
  return {
    theta: 0.7,
    phi: 0.95,
    dist: Math.max(260, Math.min(1800, Math.max(params?.W || 160, params?.H || 220, params?.D || 160) * 2.8)),
    target: new THREE.Vector3(0, 0, 0),
  };
}

let cameraState = {
  theta: 0.7,
  phi: 0.95,
  dist: 620,
  target: new THREE.Vector3(0, 0, 0),
};

function resetCameraView() {
  cameraState = initialCameraState();
  renderViewer();
}

function download(bytesOrText, filename, type) {
  const blob = new Blob([bytesOrText], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

function toDownloadBytes(raw) {
  if (raw instanceof Uint8Array) return raw.slice();
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength).slice();
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return null;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : '';
}

function readLeU32(bytes, offset) {
  if (!bytes || bytes.byteLength < offset + 4) return null;
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function stlByteDiagnostics(bytes) {
  const byteLength = bytes?.byteLength || 0;
  const binaryTriangleCount = readLeU32(bytes, 80);
  const expectedBinaryBytes = binaryTriangleCount === null ? null : 84 + binaryTriangleCount * 50;
  const binaryShapeMatches = expectedBinaryBytes !== null && expectedBinaryBytes <= byteLength;
  return {
    byteLength,
    firstBytes: Array.from((bytes || []).slice(0, 16)),
    formatGuess: binaryShapeMatches ? 'binary' : 'ascii-or-unknown',
    binaryTriangleCount: binaryShapeMatches ? binaryTriangleCount : null,
    expectedBinaryBytes: binaryShapeMatches ? expectedBinaryBytes : null,
    extraBytes: binaryShapeMatches ? byteLength - expectedBinaryBytes : null,
    wasmTriangleLimit: MAX_DECO_STL_TRIANGLES_HINT,
    overTriangleLimit: binaryShapeMatches ? binaryTriangleCount > MAX_DECO_STL_TRIANGLES_HINT : null,
  };
}

function decoFileKind(file) {
  if (!file) return null;
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  if (name.endsWith('.stl') || mime.includes('stl') || mime === 'model/stl') {
    return { sourceType: 'stl', isSvg: false, isStl: true };
  }
  if (mime.includes('svg') || name.endsWith('.svg')) {
    return { sourceType: 'svg', isSvg: true, isStl: false };
  }
  if (mime.startsWith('image/')) {
    return { sourceType: DECO_RASTER_MIME_TYPES[mime] || 'png', isSvg: false, isStl: false };
  }
  const mimeType = DECO_RASTER_MIME_TYPES[mime];
  if (mimeType) return { sourceType: mimeType, isSvg: false, isStl: false };
  const ext = name.match(/\.([a-z0-9]+)$/)?.[1] || '';
  const extType = DECO_RASTER_EXTENSIONS[ext];
  return extType ? { sourceType: extType, isSvg: false, isStl: false } : null;
}

function decoHasSource(deco) {
  return Boolean(deco && deco.sourceData && deco.sourceType);
}

function decoHasHeightmapSource(deco) {
  return decoHasSource(deco) && deco.sourceType !== 'stl';
}

function decoRasterSize(deco) {
  return Math.max(64, Math.min(512, Number(deco?.resolution || 64) * 4));
}

function compactFileName(name) {
  const value = String(name || '').trim();
  return value.length > 90 ? `${value.slice(0, 72)}...${value.slice(-12)}` : value;
}

function resetDecoSource(deco) {
  deco.sourceType = '';
  deco.sourceText = '';
  deco.sourceData = '';
  deco.sourceName = '';
  deco.sourceBytes = 0;
  deco.enabled = false;
  deco.mode = 'heightmap';
}

function applyDecoHeightmapSource(deco, source) {
  deco.sourceType = source.sourceType;
  deco.sourceText = source.sourceText || '';
  deco.sourceData = source.sourceData || '';
  deco.sourceName = compactFileName(source.sourceName || '');
  deco.sourceBytes = Number(source.sourceBytes || 0);
  deco.mode = 'heightmap';
  deco.enabled = true;
  deco.clipToPanel = true;
}

function applyDecoStlSource(deco, source) {
  deco.sourceType = 'stl';
  deco.sourceText = '';
  deco.sourceData = source.sourceData || '';
  deco.sourceName = compactFileName(source.sourceName || '');
  deco.sourceBytes = Number(source.sourceBytes || 0);
  deco.mode = 'stl';
  deco.enabled = true;
  deco.clipToPanel = false;
  deco.lockProportions = true;
  debugStlLog('state updated from imported STL', {
    target: params?.decorActive,
    sourceName: deco.sourceName,
    sourceBytes: deco.sourceBytes,
    sourceDataChars: deco.sourceData.length,
    mode: deco.mode,
    enabled: deco.enabled,
    w: deco.w,
    h: deco.h,
    depth: deco.depth,
    posX: deco.posX,
    posY: deco.posY,
    rotation: deco.rotation,
    clipToPanel: deco.clipToPanel,
    lockProportions: deco.lockProportions,
  });
}

async function loadDecoFile(file) {
  const kind = decoFileKind(file);
  debugStlLog('file selected for decor import', {
    name: file?.name || '',
    type: file?.type || '',
    size: file?.size || 0,
    detected: kind,
    target: params?.decorActive,
  });
  if (!kind) {
    setDecoStatus(tr('decor_load_supported'), 'warn');
    debugStlLog('file rejected: unsupported decor type', {
      name: file?.name || '',
      type: file?.type || '',
    });
    return false;
  }
  const sizeLimit = kind.isStl ? MAX_DECO_STL_FILE_BYTES : MAX_DECO_FILE_BYTES;
  if (file.size > sizeLimit) {
    setDecoStatus(kind.isStl ? tr('decor_stl_too_large') : tr('decor_too_large'), 'warn');
    debugStlLog('file rejected: too large', {
      name: file.name,
      size: file.size,
      sizeLimit,
      isStl: kind.isStl,
    });
    return false;
  }
  setDecoStatus(kind.isStl ? tr('decor_stl_processing') : tr('decor_processing'), 'info');
  const deco = activeDeco();
  try {
    if (kind.isStl) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.byteLength) throw new Error('stl_empty');
      debugStlLog('stl bytes read', {
        name: file.name,
        ...stlByteDiagnostics(bytes),
      });
      applyDecoStlSource(deco, {
        sourceData: bytesToBase64(bytes),
        sourceName: file.name,
        sourceBytes: file.size,
      });
      setDecoStatus(tr('decor_stl_loaded'), 'ok');
    } else if (kind.isSvg) {
      const svgText = assertSafeSvgText(await file.text());
      const sourceData = await rasterizeSvgToPngBase64(svgText, decoRasterSize(deco));
      applyDecoHeightmapSource(deco, {
        sourceType: 'svg',
        sourceText: svgText,
        sourceData,
        sourceName: file.name,
        sourceBytes: file.size,
      });
      setDecoStatus(tr('decor_svg_heightmap'), 'ok');
    } else {
      const sourceData = await rasterizeImageFileToPngBase64(file);
      applyDecoHeightmapSource(deco, {
        sourceType: 'png',
        sourceData,
        sourceName: file.name,
        sourceBytes: file.size,
      });
      setDecoStatus(tr('decor_image_heightmap'), 'ok');
    }
    render();
    if (kind.isStl) {
      reportActiveStlExportStatus('after decor import');
    }
    debugStlLog('render requested after decor import', {
      target: params?.decorActive,
      sourceType: activeDeco()?.sourceType,
      enabled: activeDeco()?.enabled,
    });
    return true;
  } catch (err) {
    console.error(err);
    debugStlLog('decor import failed', {
      name: file?.name || '',
      isStl: kind.isStl,
      error: err?.message || String(err),
    });
    setDecoStatus(tr(kind.isStl ? 'decor_stl_failed' : 'decor_heightmap_failed', { error: err?.message || err }), 'error');
    return false;
  }
}

function phpUrl(path = '/') {
  const url = new URL(path, PHP_BASE);
  if (!url.pathname.startsWith('/api/')) {
    url.searchParams.set('lang', currentLang());
  }
  return url.toString();
}

function clientLogAllowed() {
  const now = Date.now();
  clientLogTimestamps = clientLogTimestamps.filter((timestamp) => now - timestamp < CLIENT_LOG_WINDOW_MS);
  if (clientLogTimestamps.length >= CLIENT_LOG_LIMIT) return false;
  clientLogTimestamps.push(now);
  return true;
}

function shortClientText(value, fallback = '') {
  const text = String(value || fallback);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function clientErrorContext(error) {
  return {
    name: shortClientText(error?.name || 'Error', 'Error'),
    message: shortClientText(error?.message || error, 'Client error'),
    stack: shortClientText(error?.stack || ''),
    app_version: APP_BUILD_ID,
    screen: activeTab,
    browser: shortClientText(navigator.userAgent || ''),
    url: shortClientText(window.location.pathname || ''),
  };
}

function sendClientLog(level, eventCode, message, context = {}) {
  if (!clientLogAllowed()) return;
  const headers = { 'Content-Type': 'application/json' };
  fetch(phpUrl('/api/client-log'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      level,
      event_code: eventCode,
      message: shortClientText(message, 'Client log'),
      context,
    }),
    keepalive: true,
  }).catch(() => {});
}

function clientRuntimeEventCode(event) {
  const source = `${event?.message || ''} ${event?.filename || ''}`.toLowerCase();
  return source.includes('wasm') || source.includes('webassembly') ? 'wasm_runtime_error' : 'client_runtime_error';
}

window.addEventListener('error', (event) => {
  const error = event.error || new Error(event.message || 'Client runtime error');
  sendClientLog('error', clientRuntimeEventCode(event), error.message || event.message, {
    ...clientErrorContext(error),
    filename: shortClientText(event.filename || ''),
    line: Number.isFinite(event.lineno) ? event.lineno : null,
    column: Number.isFinite(event.colno) ? event.colno : null,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled rejection'));
  sendClientLog('error', 'client_unhandled_rejection', reason.message, clientErrorContext(reason));
});

function rasterizeSvgToPngBase64(svgText, size = 256) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, size, size);
        const iw = img.naturalWidth || size;
        const ih = img.naturalHeight || size;
        const scale = Math.min(size / iw, size / ih);
        const w = iw * scale;
        const h = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const png = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrlBytes(png));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rasterization failed'));
    };
    img.src = url;
  });
}

function rasterizeImageFileToPngBase64(file, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width || 0;
        const ih = img.naturalHeight || img.height || 0;
        if (iw < 2 || ih < 2) throw new Error('image_too_small');
        const scale = Math.min(1, maxSide / iw, maxSide / ih);
        const w = Math.max(2, Math.round(iw * scale));
        const h = Math.max(2, Math.round(ih * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const png = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrlBytes(png));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    img.src = url;
  });
}

function assertSafeSvgText(svgText) {
  const raw = String(svgText || '');
  if (!raw.trim()) throw new Error('svg_empty');
  if (raw.length > MAX_DECO_FILE_BYTES) throw new Error('svg_too_large');
  const lowered = raw.toLowerCase();
  if (/<!doctype|<!entity|<\?xml-stylesheet/i.test(raw)) throw new Error('svg_external_markup');
  if (/@import|url\s*\(/i.test(raw)) throw new Error('svg_external_style');
  if (/\s(?:href|xlink:href)\s*=\s*["']?\s*(?:https?:|data:|javascript:|file:)/i.test(raw)) {
    throw new Error('svg_external_reference');
  }
  if (/\son[a-z0-9_-]+\s*=/i.test(raw)) throw new Error('svg_inline_event');
  const forbiddenTag = FORBIDDEN_SVG_TAGS.find((tag) => lowered.includes(`<${tag.toLowerCase()}`));
  if (forbiddenTag) throw new Error(`svg_forbidden_${forbiddenTag.toLowerCase()}`);

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('svg_invalid');
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('svg_root_missing');
  if (FORBIDDEN_SVG_TAGS.some((tag) => svg.querySelector(tag))) throw new Error('svg_forbidden_tag');
  if (Array.from(svg.querySelectorAll('*')).some((node) => Array.from(node.attributes || []).some((attr) => {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim().toLowerCase();
    return name.startsWith('on')
      || ((name === 'href' || name === 'xlink:href') && /^(https?:|data:|javascript:|file:)/.test(value));
  }))) {
    throw new Error('svg_unsafe_attribute');
  }
  return new XMLSerializer().serializeToString(svg);
}

function setExportStatus(message, tone = 'info') {
  let status = root.querySelector('#export-status');
  const activePanel = root.querySelector('.control-section.active');
  const activeModal = root.querySelector('.account-modal.is-open');
  const buttons = activeModal?.querySelector('.download-groups')
    || activePanel?.querySelector('.download-groups')
    || activePanel?.querySelector('.buttons')
    || root.querySelector('[data-action="export-house"]')?.closest('.buttons');
  if (!status && buttons) {
    status = document.createElement('div');
    status.id = 'export-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    buttons.after(status);
  }
  if (!status) return;
  status.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  status.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  status.className = `export-status ${tone}`;
  status.textContent = message;
}

function setDecoStatus(message, tone = 'info') {
  const status = root.querySelector('[data-deco-status]');
  if (status) {
    status.dataset.tone = tone;
    status.textContent = message;
  }
  setExportStatus(message, tone);
}

function diagnosticParamsSnapshot(source) {
  const copy = JSON.parse(JSON.stringify(source || {}));
  if (!copy.decos || typeof copy.decos !== 'object') return copy;
  Object.values(copy.decos).forEach((deco) => {
    if (!deco || typeof deco !== 'object') return;
    if (deco.sourceData) {
      deco.sourceData = `[omitted ${String(deco.sourceType || 'source')}]`;
    }
    if (deco.sourceText && String(deco.sourceText).length > 8000) {
      deco.sourceText = `${String(deco.sourceText).slice(0, 8000)}...`;
    }
  });
  return copy;
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(phpUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.error || `api_${response.status}`, payload, response.status);
  }
  return payload;
}

const DECO_LIBRARY_ALL_TRIANGLES = 0;
const DECO_LIBRARY_EDGE_VERTEX_LIMIT = 180000;
const DECO_LIBRARY_DEFAULT_VIEW = 'iso';
const DECO_LIBRARY_VIEW_UP = new THREE.Vector3(0, 1, 0);
const DECO_LIBRARY_ROTATE_DAMPING = 0.18;
const DECO_LIBRARY_ROTATE_SPEED = 0.0048;
const DECO_LIBRARY_PAN_SPEED = 0.95;
const DECO_LIBRARY_MAX_VERTICAL_DOT = 0.965;
const DECO_LIBRARY_VIEW_DIRECTIONS = {
  iso: new THREE.Vector3(0.7, -0.95, 1.45).normalize(),
  front: new THREE.Vector3(0, -0.02, 1).normalize(),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
  side: new THREE.Vector3(1, -0.02, 0).normalize(),
};

function decorLibraryTriangleReadStep(triangleCount, maxTriangles) {
  const limit = Number(maxTriangles);
  if (!Number.isFinite(limit) || limit <= 0 || limit >= triangleCount) return 1;
  return Math.max(1, Math.ceil(triangleCount / Math.max(1, limit)));
}

function parseDecorLibraryBinaryStl(bytes, maxTriangles = DECO_LIBRARY_ALL_TRIANGLES) {
  if (bytes.byteLength < 84) return [];
  const view = new DataView(bytes);
  const triCount = view.getUint32(80, true);
  const expected = 84 + (triCount * 50);
  if (triCount <= 0 || expected > bytes.byteLength) return [];
  const step = decorLibraryTriangleReadStep(triCount, maxTriangles);
  const triangles = [];
  for (let i = 0; i < triCount; i += step) {
    const base = 84 + (i * 50) + 12;
    const tri = [];
    for (let v = 0; v < 3; v += 1) {
      const offset = base + (v * 12);
      tri.push([
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ]);
    }
    triangles.push(tri);
  }
  return triangles;
}

function parseDecorLibraryAsciiStl(bytes, maxTriangles = DECO_LIBRARY_ALL_TRIANGLES) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const matches = [...text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)];
  const triCount = Math.floor(matches.length / 3);
  if (triCount <= 0) return [];
  const step = decorLibraryTriangleReadStep(triCount, maxTriangles);
  const triangles = [];
  for (let i = 0; i < triCount; i += step) {
    const tri = [];
    for (let v = 0; v < 3; v += 1) {
      const row = matches[(i * 3) + v];
      if (!row) break;
      tri.push([Number(row[1]) || 0, Number(row[2]) || 0, Number(row[3]) || 0]);
    }
    if (tri.length === 3) triangles.push(tri);
  }
  return triangles;
}

function parseDecorLibraryStlBytes(bytes, maxTriangles = DECO_LIBRARY_ALL_TRIANGLES) {
  const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer;
  const binary = parseDecorLibraryBinaryStl(buffer, maxTriangles);
  if (binary.length) return binary;
  return parseDecorLibraryAsciiStl(buffer, maxTriangles);
}

function buildLibraryPreviewGeometry(triangles = []) {
  const positions = [];
  triangles.forEach((tri) => {
    if (!Array.isArray(tri) || tri.length < 3) return;
    tri.slice(0, 3).forEach((point) => {
      if (!Array.isArray(point) || point.length < 3) return;
      positions.push(Number(point[0]) || 0, Number(point[1]) || 0, Number(point[2]) || 0);
    });
  });
  if (positions.length < 9) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function decorLibraryButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool-button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

function createDecorLibraryViewerToolbar(controller) {
  const toolbar = document.createElement('div');
  toolbar.className = 'deco-library-viewer-toolbar';
  toolbar.setAttribute('aria-label', tr('decor_library_preview_title'));

  const viewGroup = document.createElement('div');
  viewGroup.className = 'deco-library-viewer-toolbar-group';
  const viewButtons = new Map();
  [
    ['iso', tr('decor_library_view_iso')],
    ['front', tr('decor_library_view_front')],
    ['top', tr('decor_library_view_top')],
    ['side', tr('decor_library_view_side')],
  ].forEach(([view, label]) => {
    const button = decorLibraryButton(label, label, () => controller.setView(view));
    viewButtons.set(view, button);
    viewGroup.appendChild(button);
  });

  const modeGroup = document.createElement('div');
  modeGroup.className = 'deco-library-viewer-toolbar-group';
  const modeButtons = new Map();
  [
    ['rotate', tr('decor_library_rotate')],
    ['horizon', tr('decor_library_horizon')],
    ['pan', tr('decor_library_move')],
  ].forEach(([mode, label]) => {
    const button = decorLibraryButton(label, label, () => controller.setMode(mode));
    modeButtons.set(mode, button);
    modeGroup.appendChild(button);
  });

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'deco-library-viewer-toolbar-group';
  zoomGroup.appendChild(decorLibraryButton(tr('decor_library_zoom_in'), tr('decor_library_zoom_in'), () => controller.zoom(0.84)));
  zoomGroup.appendChild(decorLibraryButton(tr('decor_library_zoom_out'), tr('decor_library_zoom_out'), () => controller.zoom(1.16)));

  const actionGroup = document.createElement('div');
  actionGroup.className = 'deco-library-viewer-toolbar-group';
  actionGroup.appendChild(decorLibraryButton(tr('decor_library_fit'), tr('decor_library_fit'), () => controller.fit()));
  actionGroup.appendChild(decorLibraryButton(tr('decor_library_reset'), tr('decor_library_reset'), () => controller.reset()));

  toolbar.append(viewGroup, modeGroup, zoomGroup, actionGroup);
  controller.onStateChange((state) => {
    viewButtons.forEach((button, view) => button.setAttribute('aria-pressed', state.view === view ? 'true' : 'false'));
    modeButtons.forEach((button, mode) => button.setAttribute('aria-pressed', state.mode === mode ? 'true' : 'false'));
  });
  controller.emitState();
  return toolbar;
}

function renderDecorLibraryStlGeometry(target, geometry, options = {}) {
  if (!geometry) {
    target.textContent = tr('decor_library_error', { error: 'preview' });
    target.classList.add('deco-library-stl-error');
    return null;
  }
  target.textContent = '';
  target.classList.remove('deco-library-stl-error');
  target.classList.toggle('has-viewer-controls', Boolean(options.controls));
  const width = Math.max(options.minWidth || 64, target.clientWidth || options.width || 72);
  const height = Math.max(options.minHeight || 64, target.clientHeight || options.height || 72);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fffaf1');
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100000);
  camera.up.copy(DECO_LIBRARY_VIEW_UP);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.setAttribute('title', `${tr('decor_library_rotate')} / ${tr('decor_library_move')}`);
  let canvasHost = target;
  let shell = null;
  if (options.controls) {
    shell = document.createElement('div');
    shell.className = 'deco-library-viewer-shell';
    canvasHost = document.createElement('div');
    canvasHost.className = 'deco-library-viewer-stage';
    shell.appendChild(canvasHost);
    target.appendChild(shell);
  }
  canvasHost.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const key = new THREE.DirectionalLight(0xfff0d6, 1.0);
  key.position.set(3, -4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbeafe, 0.42);
  fill.position.set(-4, 3, 4);
  scene.add(fill);

  const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
    color: 0xb86f17,
    emissive: 0x2a1604,
    emissiveIntensity: 0.08,
    shininess: 28,
    side: THREE.DoubleSide,
  }));
  const group = new THREE.Group();
  group.add(mesh);
  const vertexCount = geometry.getAttribute('position')?.count || 0;
  if (options.showEdges !== false && vertexCount <= DECO_LIBRARY_EDGE_VERTEX_LIMIT) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 20),
      new THREE.LineBasicMaterial({ color: 0x5f3b16, transparent: true, opacity: 0.55 })
    );
    group.add(edges);
  }
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  group.position.sub(center);
  const baseDistance = radius * (options.distanceMultiplier || 2.0);
  const minDistance = radius * 0.35;
  const maxDistance = radius * 10;
  let targetDistance = baseDistance;
  let renderedDistance = baseDistance;
  let activeView = DECO_LIBRARY_DEFAULT_VIEW;
  let interactionMode = 'rotate';
  const targetCameraDir = DECO_LIBRARY_VIEW_DIRECTIONS[DECO_LIBRARY_DEFAULT_VIEW].clone();
  const renderedCameraDir = targetCameraDir.clone();
  const targetPanOffset = new THREE.Vector3();
  const renderedPanOffset = new THREE.Vector3();
  const stateListeners = new Set();
  let animationFrame = 0;
  const emitState = () => stateListeners.forEach((listener) => listener({ view: activeView, mode: interactionMode }));
  const renderNow = () => {
    camera.up.copy(DECO_LIBRARY_VIEW_UP);
    camera.position.copy(renderedCameraDir).multiplyScalar(renderedDistance).add(renderedPanOffset);
    camera.lookAt(renderedPanOffset);
    renderer.render(scene, camera);
  };
  const settleRenderTargets = () => {
    renderedCameraDir.copy(targetCameraDir);
    renderedPanOffset.copy(targetPanOffset);
    renderedDistance = targetDistance;
  };
  const animateRender = () => {
    animationFrame = 0;
    renderedCameraDir.lerp(targetCameraDir, DECO_LIBRARY_ROTATE_DAMPING).normalize();
    renderedPanOffset.lerp(targetPanOffset, DECO_LIBRARY_ROTATE_DAMPING);
    renderedDistance += (targetDistance - renderedDistance) * DECO_LIBRARY_ROTATE_DAMPING;
    renderNow();
    const settled =
      renderedCameraDir.angleTo(targetCameraDir) < 0.001 &&
      renderedPanOffset.distanceToSquared(targetPanOffset) < Math.max(radius * radius * 0.000001, 0.000001) &&
      Math.abs(renderedDistance - targetDistance) < Math.max(radius * 0.001, 0.001);
    if (!settled) {
      animationFrame = window.requestAnimationFrame(animateRender);
    } else {
      settleRenderTargets();
      renderNow();
    }
  };
  const render = (immediate = false) => {
    if (immediate) {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      settleRenderTargets();
      renderNow();
      return;
    }
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animateRender);
  };
  const orbitCamera = (dx, dy) => {
    const yaw = -dx * DECO_LIBRARY_ROTATE_SPEED;
    if (yaw) targetCameraDir.applyAxisAngle(DECO_LIBRARY_VIEW_UP, yaw).normalize();
    if (interactionMode !== 'horizon') {
      const right = new THREE.Vector3().crossVectors(DECO_LIBRARY_VIEW_UP, targetCameraDir);
      if (right.lengthSq() < 0.000001) right.set(1, 0, 0);
      right.normalize();
      const candidate = targetCameraDir.clone().applyAxisAngle(right, -dy * DECO_LIBRARY_ROTATE_SPEED).normalize();
      if (Math.abs(candidate.dot(DECO_LIBRARY_VIEW_UP)) < DECO_LIBRARY_MAX_VERTICAL_DOT) targetCameraDir.copy(candidate);
    }
  };
  camera.near = Math.max(radius / 1000, 0.01);
  camera.far = radius * 40;
  camera.updateProjectionMatrix();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
    canvasHost.classList.add('is-dragging');
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (interactionMode === 'pan') {
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const panScale = targetDistance / Math.max(width, height) * DECO_LIBRARY_PAN_SPEED;
      targetPanOffset.addScaledVector(right, -dx * panScale);
      targetPanOffset.addScaledVector(up, dy * panScale);
    } else {
      orbitCamera(dx, dy);
      activeView = 'custom';
    }
    render();
    emitState();
  });
  const finishDrag = (event) => {
    dragging = false;
    canvasHost.classList.remove('is-dragging');
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture can already be released by the browser.
    }
  };
  renderer.domElement.addEventListener('pointerup', finishDrag);
  renderer.domElement.addEventListener('pointercancel', finishDrag);
  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    targetDistance = Math.min(maxDistance, Math.max(minDistance, targetDistance * (event.deltaY > 0 ? 1.08 : 0.92)));
    render();
  }, { passive: false });
  const setMode = (mode) => {
    interactionMode = mode === 'pan' || mode === 'horizon' ? mode : 'rotate';
    canvasHost.classList.toggle('is-pan-mode', interactionMode === 'pan');
    canvasHost.classList.toggle('is-horizon-mode', interactionMode === 'horizon');
    emitState();
  };
  const setView = (name) => {
    const nextView = DECO_LIBRARY_VIEW_DIRECTIONS[name] ? name : DECO_LIBRARY_DEFAULT_VIEW;
    activeView = nextView;
    targetCameraDir.copy(DECO_LIBRARY_VIEW_DIRECTIONS[nextView]);
    targetDistance = nextView === 'front' ? radius * 1.9 : baseDistance;
    targetPanOffset.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    render();
    emitState();
  };
  const fit = () => {
    targetDistance = baseDistance;
    targetPanOffset.set(0, 0, 0);
    render();
  };
  const reset = () => {
    group.rotation.set(0, 0, 0);
    activeView = DECO_LIBRARY_DEFAULT_VIEW;
    targetCameraDir.copy(DECO_LIBRARY_VIEW_DIRECTIONS[DECO_LIBRARY_DEFAULT_VIEW]);
    targetDistance = baseDistance;
    targetPanOffset.set(0, 0, 0);
    setMode('rotate');
    render();
    emitState();
  };
  const controller = {
    render,
    setMode,
    setView,
    fit,
    reset,
    zoom(factor) {
      const value = Number(factor);
      targetDistance = Math.min(maxDistance, Math.max(minDistance, targetDistance * (Number.isFinite(value) ? value : 1)));
      render();
    },
    onStateChange(listener) {
      if (typeof listener === 'function') stateListeners.add(listener);
    },
    emitState,
  };
  if (shell && options.controls) {
    shell.insertBefore(createDecorLibraryViewerToolbar(controller), canvasHost);
  }
  setMode(options.mode || 'rotate');
  render(true);
  return controller;
}

function renderDecorLibraryStlPayload(target, payload, options = {}) {
  return renderDecorLibraryStlGeometry(target, buildLibraryPreviewGeometry(payload.mesh_triangles || []), options);
}

async function renderDecorLibraryOriginalStl(target, item, options = {}) {
  if (!item?.app_original_url) return false;
  const url = new URL(item.app_original_url, window.location.href).toString();
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(response.statusText || 'local_stl_load_failed');
  const bytes = await response.arrayBuffer();
  const triangles = parseDecorLibraryStlBytes(bytes, DECO_LIBRARY_ALL_TRIANGLES);
  const geometry = buildLibraryPreviewGeometry(triangles);
  if (!geometry) throw new Error('local_stl_parse_failed');
  renderDecorLibraryStlGeometry(target, geometry, {
    ...options,
    showEdges: triangles.length <= 60000,
  });
  debugStlLog('decor library original STL rendered in WASM preview', {
    itemId: item.id,
    bytes: bytes.byteLength,
    triangles: triangles.length,
    url,
    untouched: true,
  });
  return true;
}

async function renderDecorLibraryStlPreviews(container) {
  const targets = Array.from(container.querySelectorAll('[data-deco-library-stl-preview]'));
  await Promise.all(targets.map(async (target) => {
    const itemId = Number(target.dataset.decoLibraryStlPreview || 0);
    if (!itemId || target.dataset.previewRendered === '1') return;
    target.dataset.previewRendered = '1';
    try {
      const payload = await apiRequest(`/api/library/stl-preview?item_id=${encodeURIComponent(itemId)}`);
      renderDecorLibraryStlPayload(target, payload);
      debugStlLog('decor library STL preview rendered in WASM panel', {
        itemId,
        sampled_triangles: payload.sampled_triangles,
        bbox: payload.bbox,
      });
    } catch (err) {
      target.textContent = tr('decor_library_error', { error: 'preview' });
      target.classList.add('deco-library-stl-error');
      debugStlLog('decor library STL preview failed in WASM panel', {
        itemId,
        error: err?.message || String(err),
      });
    }
  }));
}

function renderDecorLibraryItems(items = []) {
  if (!items.length) {
    return `<p class="control-note">${escapeHtml(tr('decor_library_empty'))}</p>`;
  }
  return items.map((item) => `
    <article class="deco-library-item">
      <img src="${escapeHtml(phpUrl(item.thumbnail_url || `/api/library/thumbnail?item_id=${item.id}`))}" alt="Preview ${escapeHtml(item.title || item.original_filename || '')}" loading="lazy" data-deco-library-thumbnail="${escapeHtml(item.id)}">
      <div class="deco-library-copy">
        <strong>${escapeHtml(item.title || item.original_filename || '')}</strong>
        ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}
        <small>${escapeHtml(item.original_filename || '')} · ${formatFileSize(item.file_size_bytes)} · ${formatCreditText(item.cost)}</small>
      </div>
      <div class="deco-library-item-actions">
        ${String(item.media_type || item.file_ext || '').toLowerCase() === 'stl'
          ? `<button class="tool-button" type="button" data-library-preview="${escapeHtml(item.id)}">${escapeHtml(tr('decor_library_preview'))}</button>`
          : ''}
        <button class="tool-button" type="button" data-library-download="${escapeHtml(item.id)}">${escapeHtml(tr('decor_library_download'))}</button>
      </div>
    </article>
  `).join('');
}

function attachDecorLibraryThumbnailFallbacks(container) {
  container.querySelectorAll('[data-deco-library-thumbnail]').forEach((img) => {
    img.addEventListener('error', () => {
      const itemId = Number(img.dataset.decoLibraryThumbnail || 0);
      const fallback = document.createElement('div');
      fallback.className = 'deco-library-thumbnail-fallback';
      fallback.textContent = 'PNG indisponible';
      img.replaceWith(fallback);
      debugStlLog('decor library thumbnail failed in WASM panel', { itemId, src: img.currentSrc || img.src });
    }, { once: true });
  });
}

function ensureDecorLibraryPreviewModal(panel) {
  let modal = root.querySelector('[data-deco-library-preview-modal]');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'deco-library-preview-modal';
  modal.hidden = true;
  modal.dataset.decoLibraryPreviewModal = '1';
  modal.innerHTML = `
    <div class="deco-library-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="deco-library-preview-title">
      <div class="deco-library-preview-head">
        <div>
          <h3 id="deco-library-preview-title">${escapeHtml(tr('decor_library_preview_title'))}</h3>
          <p data-deco-library-preview-meta></p>
        </div>
        <button class="tool-button" type="button" data-deco-library-preview-close>${escapeHtml(tr('decor_library_preview_close'))}</button>
      </div>
      <div class="deco-library-preview-stage" data-deco-library-preview-stage></div>
      <div class="deco-library-preview-actions">
        <button class="tool-button" type="button" data-deco-library-preview-close>${escapeHtml(tr('decor_library_preview_close'))}</button>
        <button class="tool-button primary-action" type="button" data-deco-library-preview-download>${escapeHtml(tr('decor_library_download'))}</button>
      </div>
      <p class="deco-status" data-deco-library-preview-status></p>
    </div>
  `;
  const close = () => {
    modal.hidden = true;
    modal.dataset.itemId = '';
    modal.querySelector('[data-deco-library-preview-stage]')?.replaceChildren();
    const status = modal.querySelector('[data-deco-library-preview-status]');
    if (status) status.textContent = '';
  };
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-deco-library-preview-close]')) {
      close();
    }
  });
  modal.querySelector('[data-deco-library-preview-download]')?.addEventListener('click', async (event) => {
    const itemId = Number(modal.dataset.itemId || 0);
    if (!itemId) return;
    const status = modal.querySelector('[data-deco-library-preview-status]');
    event.currentTarget.disabled = true;
    try {
      const payload = await authorizeLibraryDownload(itemId);
      if (status) status.textContent = tr('decor_library_started');
      const panelStatus = panel.querySelector('[data-deco-library-status]');
      if (panelStatus) panelStatus.textContent = tr('decor_library_started');
      debugStlLog('decor library download authorized from preview modal', {
        itemId: payload.item_id,
        cost: payload.cost,
        admin: Boolean(payload.admin),
      });
      window.location.href = phpUrl(payload.download_url);
    } catch (err) {
      const message = err?.status === 402
        ? tr('decor_library_insufficient')
        : tr('decor_library_error', { error: err?.message || err });
      if (status) status.textContent = message;
      debugStlLog('decor library download failed from preview modal', {
        itemId,
        status: err?.status || 0,
        error: err?.message || String(err),
      });
    } finally {
      event.currentTarget.disabled = false;
    }
  });
  root.appendChild(modal);
  return modal;
}

async function openDecorLibraryPreviewModal(panel, itemId) {
  const item = decorLibraryItemsById.get(Number(itemId));
  if (!item) return;
  const modal = ensureDecorLibraryPreviewModal(panel);
  const stage = modal.querySelector('[data-deco-library-preview-stage]');
  const status = modal.querySelector('[data-deco-library-preview-status]');
  const meta = modal.querySelector('[data-deco-library-preview-meta]');
  const title = modal.querySelector('#deco-library-preview-title');
  modal.dataset.itemId = String(item.id);
  modal.hidden = false;
  if (title) title.textContent = item.title || item.original_filename || tr('decor_library_preview_title');
  if (meta) {
    meta.textContent = `${item.original_filename || ''} · ${formatFileSize(item.file_size_bytes)} · ${formatCreditText(item.cost)}`;
  }
  if (stage) {
    stage.classList.remove('deco-library-stl-error');
    stage.replaceChildren();
    stage.textContent = tr('decor_library_preview_loading');
  }
  if (status) status.textContent = '';
  debugStlLog('decor library preview modal opened', { itemId: item.id });
  try {
    let renderedOriginal = false;
    if (stage && item.app_original_url) {
      try {
        stage.replaceChildren();
        renderedOriginal = await renderDecorLibraryOriginalStl(stage, item, {
          controls: true,
          minWidth: 280,
          minHeight: 320,
          distanceMultiplier: 2.0,
        });
      } catch (originalErr) {
        debugStlLog('decor library original STL preview failed, falling back to API mesh', {
          itemId: item.id,
          url: item.app_original_url,
          error: originalErr?.message || String(originalErr),
        });
      }
    }
    let payload = null;
    if (!renderedOriginal) {
      payload = await apiRequest(`/api/library/stl-preview?item_id=${encodeURIComponent(item.id)}&detail=high`);
      if (stage) {
        stage.replaceChildren();
        renderDecorLibraryStlPayload(stage, payload, {
          controls: true,
          minWidth: 280,
          minHeight: 320,
          distanceMultiplier: 2.0,
        });
      }
    }
    debugStlLog('decor library preview modal rendered', {
      itemId: item.id,
      source: renderedOriginal ? 'local_original_stl' : 'api_preview_mesh',
      sampled_triangles: payload?.sampled_triangles || null,
      bbox: payload?.bbox || null,
    });
  } catch (err) {
    if (stage) {
      stage.textContent = tr('decor_library_error', { error: 'preview' });
      stage.classList.add('deco-library-stl-error');
    }
    if (status) status.textContent = tr('decor_library_error', { error: err?.message || err });
    debugStlLog('decor library preview modal failed', {
      itemId: item.id,
      error: err?.message || String(err),
    });
  }
}

async function loadDecorLibraryPanel() {
  const panel = root.querySelector('[data-deco-library-panel]');
  if (!panel) return;
  const list = panel.querySelector('[data-deco-library-list]');
  const status = panel.querySelector('[data-deco-library-status]');
  if (!list || !status) return;
  status.textContent = tr('decor_library_loading');
  list.innerHTML = '';
  try {
    const payload = await apiRequest('/api/library');
    const items = Array.isArray(payload.items) ? payload.items : [];
    decorLibraryItemsById = new Map(items.map((item) => [Number(item.id), item]));
    list.innerHTML = renderDecorLibraryItems(items);
    attachDecorLibraryThumbnailFallbacks(list);
    status.textContent = items.length ? tr('decor_library_ready', { count: items.length }) : tr('decor_library_empty');
    debugStlLog('decor library loaded in WASM panel', {
      count: items.length,
      items: items.map((item) => ({ id: item.id, name: item.original_filename, cost: item.cost })),
    });
  } catch (err) {
    list.innerHTML = '';
    status.textContent = tr('decor_library_error', { error: err?.message || err });
    debugStlLog('decor library load failed in WASM panel', { error: err?.message || String(err) });
  }
}

async function authorizeLibraryDownload(itemId) {
  const payload = await apiRequest('/api/library/authorize', {
    method: 'POST',
    body: JSON.stringify({ item_id: Number(itemId || 0) }),
  });
  if (!payload.download_url) throw new Error('library_download_url_missing');
  return payload;
}

function attachDecorLibraryPanel() {
  const panel = root.querySelector('[data-deco-library-panel]');
  if (!panel) return;
  ensureDecorLibraryPreviewModal(panel);
  panel.querySelector('[data-deco-library-open]')?.setAttribute('href', phpUrl('/library'));
  panel.querySelector('[data-deco-library-refresh]')?.addEventListener('click', () => {
    loadDecorLibraryPanel();
  });
  panel.querySelector('[data-deco-library-list]')?.addEventListener('click', async (event) => {
    const previewButton = event.target.closest('[data-library-preview]');
    if (previewButton) {
      openDecorLibraryPreviewModal(panel, previewButton.dataset.libraryPreview);
      return;
    }
    const button = event.target.closest('[data-library-download]');
    if (!button) return;
    const status = panel.querySelector('[data-deco-library-status]');
    button.disabled = true;
    try {
      const payload = await authorizeLibraryDownload(button.dataset.libraryDownload);
      if (status) status.textContent = tr('decor_library_started');
      debugStlLog('decor library download authorized from WASM panel', {
        itemId: payload.item_id,
        cost: payload.cost,
        admin: Boolean(payload.admin),
      });
      window.location.href = phpUrl(payload.download_url);
    } catch (err) {
      if (status) {
        status.textContent = err?.status === 402
          ? tr('decor_library_insufficient')
          : tr('decor_library_error', { error: err?.message || err });
      }
      debugStlLog('decor library download failed from WASM panel', {
        itemId: button.dataset.libraryDownload,
        status: err?.status || 0,
        error: err?.message || String(err),
      });
    } finally {
      button.disabled = false;
    }
  });
  loadDecorLibraryPanel();
}

function applyAdminVisibility() {
  root.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.hidden = !adminSession.admin;
  });
}

async function refreshAdminSession({ silent = true } = {}) {
  try {
    const payload = await apiRequest('/api/admin/session');
    adminSession = {
      checked: true,
      admin: Boolean(payload.admin),
    };
  } catch (err) {
    if (!silent) console.warn('admin session check failed', err);
    adminSession = {
      checked: true,
      admin: false,
    };
  }
  applyAdminVisibility();
  return adminSession.admin;
}

async function hasAdminExportAccess() {
  if (adminSession.admin) return true;
  if (!adminSession.checked) {
    return refreshAdminSession({ silent: true });
  }
  return false;
}

function buildMeshReportSnapshot() {
  const payload = parseResponse(mesh_report_json(JSON.stringify(params)));
  if (!payload) return null;
  return {
    saved_at: new Date().toISOString(),
    app_version: APP_BUILD_ID,
    lang: currentLang(),
    params: diagnosticParamsSnapshot(params),
    report: payload,
  };
}

function saveMeshReportToBrowser() {
  try {
    const snapshot = buildMeshReportSnapshot();
    if (!snapshot) return null;
    localStorage.setItem(MESH_REPORT_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch (err) {
    console.warn('mesh report save failed', err);
    return null;
  }
}

function reportActiveStlExportStatus(reason = '') {
  const target = params?.decorActive;
  const deco = activeDeco();
  if (!target || deco?.sourceType !== 'stl') return null;
  try {
    const payload = parseResponse(mesh_report_json(JSON.stringify(params)));
    const expectedPartName = `deco_${target}`;
    const parts = Array.isArray(payload?.parts) ? payload.parts : [];
    const part = parts.find((item) => item?.name === expectedPartName) || null;
    debugStlLog('strict export report for active STL decor', {
      reason,
      target,
      expectedPartName,
      exportPartPresent: Boolean(part),
      exportPart: part,
      exportDecorParts: parts
        .filter((item) => String(item?.name || '').startsWith('deco_'))
        .map((item) => ({
          name: item.name,
          triangles: item.triangles,
          open_edges: item.open_edges,
          non_manifold_edges: item.non_manifold_edges,
          watertight: item.watertight,
          warnings: item.warnings,
        })),
    });
    if (!part) {
      setDecoStatus(tr('decor_stl_export_omitted'), 'warn');
    }
    return part;
  } catch (err) {
    debugStlLog('strict export report failed for active STL decor', {
      reason,
      target,
      error: err?.message || String(err),
    });
    return null;
  }
}

function exportGateContent(kind, context = {}) {
  const filename = context.filename || '';
  const cost = Number.isFinite(Number(context.cost)) ? formatCreditText(Number(context.cost)) : '';
  const credits = Number.isFinite(Number(context.credits)) ? formatCreditText(Number(context.credits)) : formatCreditText(0);
  const bonus = Number.isFinite(Number(context.bonus)) ? formatCreditText(Number(context.bonus)) : formatCreditText(0);

  if (kind === 'bonus') {
    return {
      title: tr('export_gate_bonus_title'),
      body: tr('export_gate_bonus_body', { credits, cost, bonus }),
      note: tr('export_gate_bonus_note'),
      primaryAction: 'bonus',
      primaryLabel: tr('export_gate_activate_bonus'),
      secondaryAction: 'cancel',
      secondaryLabel: tr('export_gate_cancel'),
      filename,
    };
  }

  if (kind === 'credits') {
    return {
      title: tr('export_gate_credit_title'),
      body: tr('export_gate_credit_body', { credits, cost }),
      note: tr('export_gate_credit_marketing'),
      primaryAction: 'buy',
      primaryLabel: tr('export_gate_buy_credits'),
      secondaryAction: 'cancel',
      secondaryLabel: tr('export_gate_close'),
      filename,
    };
  }

  return {
    title: tr('export_gate_guest_title'),
    body: tr('export_gate_guest_body'),
    note: tr('export_gate_guest_marketing'),
    primaryAction: 'buy',
    primaryLabel: tr('export_gate_buy_credits'),
    secondaryAction: 'signin',
    secondaryLabel: tr('export_gate_sign_in'),
    filename,
  };
}

function openExportGateModal(kind, context = {}) {
  const content = exportGateContent(kind, context);
  const previousFocus = document.activeElement;
  root.querySelector('.export-gate-modal')?.remove();

  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'export-gate-modal';
    modal.innerHTML = `
      <div class="export-gate-backdrop" data-export-gate-action="cancel"></div>
      <section class="export-gate-sheet" role="dialog" aria-modal="true" aria-labelledby="export-gate-title" tabindex="-1">
        <header>
          <p class="eyebrow">${escapeHtml(tr('export_gate_eyebrow'))}</p>
          <h2 id="export-gate-title">${escapeHtml(content.title)}</h2>
          ${content.filename ? `<p class="export-gate-file">${escapeHtml(content.filename)}</p>` : ''}
        </header>
        <p>${escapeHtml(content.body)}</p>
        <p class="export-gate-note">${escapeHtml(content.note)}</p>
        <div class="export-gate-actions">
          <button class="primary-action" type="button" data-export-gate-action="${escapeHtml(content.primaryAction)}">${escapeHtml(content.primaryLabel)}</button>
          <button type="button" data-export-gate-action="${escapeHtml(content.secondaryAction)}">${escapeHtml(content.secondaryLabel)}</button>
        </div>
      </section>
    `;

    const close = (action) => {
      modal.remove();
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      resolve(action);
    };

    modal.addEventListener('click', (event) => {
      const button = event.target.closest('[data-export-gate-action]');
      if (!button) return;
      const action = button.dataset.exportGateAction;
      if (action === 'buy') {
        close(action);
        window.location.href = phpUrl('/pricing');
        return;
      }
      if (action === 'signin') {
        close(action);
        loginAccount();
        return;
      }
      close(action);
    });

    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close('cancel');
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    root.append(modal);
    modal.querySelector('.export-gate-sheet')?.focus({ preventScroll: true });
  });
}

function setAccountText(selector, value) {
  root.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function accountStatusLabel() {
  if (accountState.loading) return tr('account_loading');
  if (accountState.user) return tr('account_connected');
  return tr('account_disconnected');
}

function readableApiError(error) {
  const code = error?.message || String(error);
  return {
    activation_unavailable: tr('activation_unavailable'),
    activation_failed: tr('activation_failed'),
    too_many_requests: tr('too_many_requests'),
    invalid_credentials: tr('invalid_credentials'),
    unauthorized: tr('login_required_download'),
    insufficient_credits: tr('insufficient_credits'),
    account_suspended: tr('subscription_suspended'),
  }[code] || code;
}

function ticketStatusLabel(status) {
  return {
    open: tr('ticket_state_open'),
    closed: tr('ticket_state_closed'),
  }[status] || status || '';
}

function ticketPriorityLabel(priority) {
  return {
    normal: tr('ticket_priority_normal'),
    urgent: tr('ticket_priority_urgent'),
  }[priority] || priority || '';
}

function authorRoleLabel(role) {
  return role === 'admin' ? tr('support') : tr('client');
}

function subscriptionStatusLabel(status) {
  if (!status || status === 'none') return tr('plan_none');
  return tr(`subscription_${String(status).toLowerCase()}`);
}

function updateAccountDom() {
  const user = accountState.user;
  setAccountText('[data-account-balance]', user ? String(user.credits ?? 0) : '0');
  setAccountText('[data-account-state]', accountStatusLabel());
  setAccountText('[data-account-email-label]', user?.email || '-');
  setAccountText('[data-account-plan]', subscriptionStatusLabel(user?.subscription_status));
  setAccountText('[data-account-error]', accountState.error || '');
  root.querySelectorAll('[data-account-authed]').forEach((el) => {
    el.hidden = !user;
  });
  root.querySelectorAll('[data-account-guest]').forEach((el) => {
    el.hidden = Boolean(user);
  });
  if (!user) {
    accountTickets = [];
    accountTicketDetail = null;
    selectedAccountTicketId = null;
    renderAccountTickets();
    renderAccountTicketDetail(null);
  }
}

function renderAccountTickets() {
  const list = root.querySelector('[data-account-ticket-list]');
  if (!list) return;
  if (!accountTickets.length) {
    list.innerHTML = `<p class="control-note">${escapeHtml(tr('no_ticket'))}</p>`;
    return;
  }
  list.innerHTML = accountTickets.slice(0, 8).map((ticket) => `
    <div class="ticket-mini-row">
      <div class="ticket-mini-title">
        <strong>#${escapeHtml(ticket.id)} ${escapeHtml(ticket.subject)}</strong>
        <span>${escapeHtml(ticketStatusLabel(ticket.status))} · ${escapeHtml(ticketPriorityLabel(ticket.priority || 'normal'))} · ${escapeHtml(formatDisplayDate(ticket.updated_at || ticket.created_at))}</span>
      </div>
      <button type="button" data-account-ticket-open="${escapeHtml(ticket.id)}">${escapeHtml(tr('open'))}</button>
    </div>
  `).join('');
}

function renderAccountTicketDetail(payload) {
  const box = root.querySelector('[data-account-ticket-detail]');
  if (!box) return;
  if (!payload?.ticket) {
    box.hidden = true;
    accountTicketDetail = null;
    return;
  }
  accountTicketDetail = payload;
  box.hidden = false;
  const ticket = payload.ticket;
  const title = root.querySelector('[data-account-ticket-title]');
  if (title) title.textContent = `#${ticket.id} ${ticket.subject} · ${ticketStatusLabel(ticket.status)}`;
  const toggle = root.querySelector('[data-action="account-ticket-toggle"]');
  if (toggle) toggle.textContent = ticket.status === 'open' ? tr('close') : tr('reopen');
  const reply = root.querySelector('[data-account-ticket-reply-form]');
  if (reply) reply.hidden = ticket.status !== 'open';
  const thread = root.querySelector('[data-account-ticket-thread]');
  if (!thread) return;
  thread.innerHTML = (payload.messages || []).length
    ? payload.messages.map((message) => `
      <article class="ticket-mini-message ${escapeHtml(message.author_role || 'client')}">
        <header><strong>${escapeHtml(authorRoleLabel(message.author_role))}</strong><span>${escapeHtml(formatDisplayDate(message.created_at))}</span></header>
        <p>${escapeHtml(message.body).replace(/\n/g, '<br>')}</p>
      </article>
    `).join('')
    : `<p class="control-note">${escapeHtml(tr('no_message'))}</p>`;
}

async function loadAccountTickets({ openFirst = false } = {}) {
  if (!accountState.user) {
    accountTickets = [];
    renderAccountTickets();
    renderAccountTicketDetail(null);
    return;
  }
  try {
    const payload = await apiRequest('/api/tickets');
    accountTickets = payload.tickets || [];
    renderAccountTickets();
    if ((!selectedAccountTicketId && openFirst) || !accountTickets.some((ticket) => Number(ticket.id) === Number(selectedAccountTicketId))) {
      selectedAccountTicketId = accountTickets[0]?.id || null;
    }
    if (selectedAccountTicketId) await loadAccountTicketDetail(selectedAccountTicketId);
    else renderAccountTicketDetail(null);
  } catch (err) {
    accountState.error = tr('tickets_error', { error: err?.message || err });
    updateAccountDom();
  }
}

async function loadAccountTicketDetail(ticketId) {
  if (!ticketId) return;
  selectedAccountTicketId = ticketId;
  const payload = await apiRequest(`/api/tickets/${ticketId}`);
  renderAccountTicketDetail(payload);
}

async function refreshAccountState({ silent = false } = {}) {
  accountState.loading = true;
  if (!silent) accountState.error = '';
  updateAccountDom();
  try {
    const payload = await apiRequest('/api/me');
    accountState = { user: payload.user || null, loading: false, error: '' };
    updateAccountDom();
    await loadAccountTickets();
    return accountState.user;
  } catch (err) {
    accountState = {
      user: null,
      loading: false,
      error: silent || err?.message === 'unauthorized' ? '' : tr('invalid_session', { error: err?.message || err }),
    };
    updateAccountDom();
    return null;
  }
}

async function loginAccount() {
  window.location.href = phpUrl('/account');
}

async function logoutAccount() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('logout failed', err);
  }
  accountState = { user: null, loading: false, error: '' };
  updateAccountDom();
  setExportStatus(tr('account_logged_out'), 'info');
}

async function authorizeExport(exportType, filename) {
  if (!accountState.user && !(await hasAdminExportAccess())) {
    throw new Error('connexion_requise');
  }
  setExportStatus(tr('authorizing_export', { filename }), 'info');
  return apiRequest('/api/exports/authorize', {
    method: 'POST',
    body: JSON.stringify({ app_id: EXPORT_APP_ID, export_type: exportType }),
  });
}

async function quoteExport(exportType) {
  if (!accountState.user && !(await hasAdminExportAccess())) {
    throw new Error('connexion_requise');
  }
  return apiRequest('/api/exports/quote', {
    method: 'POST',
    body: JSON.stringify({ app_id: EXPORT_APP_ID, export_type: exportType }),
  });
}

async function consumeExport(authorization) {
  if (!authorization) return null;
  const payload = await apiRequest('/api/exports/consume', {
    method: 'POST',
    body: JSON.stringify({ app_id: EXPORT_APP_ID, authorization }),
  });
  if (payload.user) {
    accountState = { user: payload.user, loading: false, error: '' };
    updateAccountDom();
  } else if (payload.admin) {
    return payload;
  } else {
    await refreshAccountState({ silent: true });
  }
  return payload;
}

function exportDeniedMessage(err) {
  const code = err?.message || String(err);
  if (code === 'connexion_requise' || code === 'unauthorized') {
    return tr('login_required_download');
  }
  if (code === 'insufficient_credits') {
    return tr('insufficient_credits');
  }
  return tr('authorization_denied', { code });
}

async function authorizeExportWithPrompt(exportType, filename) {
  if (await hasAdminExportAccess()) {
    return authorizeExport(exportType, filename);
  }

  if (!accountState.user) {
    await openExportGateModal('guest', { filename, exportType });
    return null;
  }

  let quote = null;
  try {
    quote = await quoteExport(exportType);
  } catch (err) {
    const code = err?.message || String(err);
    if (code === 'connexion_requise' || code === 'unauthorized') {
      await openExportGateModal('guest', { filename, exportType });
      return null;
    }
    if (code === 'insufficient_credits') {
      await openExportGateModal('credits', {
        filename,
        exportType,
        credits: Number(err?.payload?.credits ?? accountState.user?.credits ?? 0),
        cost: Number(err?.payload?.cost ?? EXPORT_COSTS[exportType] ?? 0),
      });
      return null;
    }
    throw err;
  }

  const bonus = Number(quote?.bonus_credits || 0);
  if (bonus > 0) {
    const cost = Number(quote?.cost ?? EXPORT_COSTS[exportType] ?? 0);
    const action = await openExportGateModal('bonus', {
      filename,
      exportType,
      credits: Number(quote?.credits ?? Math.max(0, cost - bonus)),
      cost,
      bonus,
    });
    if (action !== 'bonus') {
      return null;
    }
  }

  try {
    return await authorizeExport(exportType, filename);
  } catch (err) {
    const code = err?.message || String(err);
    if (code === 'insufficient_credits') {
      await openExportGateModal('credits', {
        filename,
        exportType,
        credits: Number(err?.payload?.credits ?? accountState.user?.credits ?? 0),
        cost: Number(err?.payload?.cost ?? quote?.cost ?? EXPORT_COSTS[exportType] ?? 0),
      });
      return null;
    }
    throw err;
  }
}

async function exportBinaryAuthorized(filename, type, exportType, producer, emptyMessage) {
  let auth = null;
  try {
    auth = await authorizeExportWithPrompt(exportType, filename);
    if (!auth) return false;
    const bytes = toDownloadBytes(producer());
    if (!bytes || !bytes.byteLength) {
      setExportStatus(emptyMessage, 'warn');
      return false;
    }
    download(bytes, filename, type);
    const consumed = await consumeExport(auth.authorization);
    const credits = consumed?.user?.credits ?? accountState.user?.credits;
    const suffix = Number.isFinite(credits) ? ` ${tr('remaining_credits', { count: formatCountText(credits) })}` : '';
    setExportStatus(tr('file_created_bytes', {
      filename,
      size: formatCountText(bytes.byteLength),
      cost: auth.cost ?? EXPORT_COSTS[exportType] ?? '?',
      suffix,
    }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(exportDeniedMessage(err), 'error');
    return false;
  }
}

async function exportTextAuthorized(filename, type, exportType, producer, emptyMessage) {
  try {
    const auth = await authorizeExportWithPrompt(exportType, filename);
    if (!auth) return false;
    const text = producer();
    if (!text || !String(text).length) {
      setExportStatus(emptyMessage, 'warn');
      return false;
    }
    download(String(text), filename, type);
    const consumed = await consumeExport(auth.authorization);
    const credits = consumed?.user?.credits ?? accountState.user?.credits;
    const suffix = Number.isFinite(credits) ? ` ${tr('remaining_credits', { count: formatCountText(credits) })}` : '';
    setExportStatus(tr('file_created_chars', {
      filename,
      size: formatCountText(String(text).length),
      cost: auth.cost ?? EXPORT_COSTS[exportType] ?? '?',
      suffix,
    }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(exportDeniedMessage(err), 'error');
    return false;
  }
}

async function runAuthorizedExport(exportType, filename, producer) {
  try {
    const auth = await authorizeExportWithPrompt(exportType, filename);
    if (!auth) return false;
    const ok = await producer();
    if (ok) await consumeExport(auth.authorization);
    return Boolean(ok);
  } catch (err) {
    console.error(err);
    setExportStatus(exportDeniedMessage(err), 'error');
    return false;
  }
}

function exportBinary(filename, type, producer, emptyMessage) {
  try {
    const bytes = toDownloadBytes(producer());
    if (!bytes || !bytes.byteLength) {
      setExportStatus(emptyMessage, 'warn');
      return;
    }
    download(bytes, filename, type);
    setExportStatus(tr('file_created_simple_bytes', { filename, size: formatCountText(bytes.byteLength) }), 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
  }
}

function cleanPdfText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°]/g, ' deg')
    .replace(/[×]/g, ' x ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfString(value) {
  return cleanPdfText(value).replace(/[\\()]/g, '\\$&');
}

function wrapPdfLine(line, max = 86) {
  const words = cleanPdfText(line).split(' ').filter(Boolean);
  const wrapped = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

function collectCalculationLines() {
  const panel = root.querySelector('[data-panel="calcs"]');
  const lines = [
    tr('calculations_title'),
    tr('generated_at', { date: formatDateTime(new Date()) }),
    '',
    tr('calculations_section'),
  ];
  panel?.querySelectorAll('.stat-row').forEach((row) => {
    const label = row.querySelector('span')?.textContent || '';
    const value = row.querySelector('strong')?.textContent || '';
    lines.push(`${label}: ${value}`);
  });
  lines.push('', tr('pieces_section'));
  panel?.querySelectorAll('.cut-row').forEach((row) => {
    const name = row.querySelector('span')?.textContent || '';
    const qty = row.querySelector('strong')?.textContent || '';
    const dims = row.querySelector('small')?.textContent || '';
    const note = row.querySelector('em')?.textContent || '';
    lines.push(`${name} | ${tr('quantity_short')} ${qty} | ${dims}${note ? ` | ${note}` : ''}`);
  });
  return lines.flatMap((line) => wrapPdfLine(line));
}

function buildSimplePdf(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 46;
  const topY = 796;
  const lineHeight = 14;
  const bottomY = 46;
  const pages = [];
  let pageLines = [];
  let y = topY;

  lines.forEach((line) => {
    if (y < bottomY) {
      pages.push(pageLines);
      pageLines = [];
      y = topY;
    }
    pageLines.push(line);
    y -= lineHeight;
  });
  if (pageLines.length) pages.push(pageLines);

  const objects = [
    '',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const pageObjectNumbers = [];

  pages.forEach((page) => {
    const contentLines = [];
    let cursorY = topY;
    page.forEach((line, index) => {
      const size = index === 0 && pageObjectNumbers.length === 0 ? 16 : 10;
      const leading = index === 0 && pageObjectNumbers.length === 0 ? 20 : lineHeight;
      contentLines.push(`BT /F1 ${size} Tf 1 0 0 1 ${marginX} ${cursorY} Tm (${escapePdfString(line)}) Tj ET`);
      cursorY -= leading;
    });
    const stream = contentLines.join('\n');
    const contentObj = objects.length + 1;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageObj = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`);
    pageObjectNumbers.push(pageObj);
  });

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function downloadCalculationsPdf() {
  try {
    const lines = collectCalculationLines();
    const pdf = buildSimplePdf(lines);
    const filename = exportFilename('calcs_pdf');
    download(pdf, filename, 'application/pdf');
    setExportStatus(tr('file_created_named', { filename }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
    return false;
  }
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `${hex}>`;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrlBytes(dataUrl);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function renderSvgToImage(svgText, options = {}) {
  const {
    maxWidth = 1500,
    mime = 'image/jpeg',
    quality = 0.92,
    background = '#fffaf1',
  } = options;
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const sourceW = img.naturalWidth || 1200;
        const sourceH = img.naturalHeight || 800;
        const scale = Math.min(1, maxWidth / sourceW);
        const width = Math.max(320, Math.round(sourceW * scale));
        const height = Math.max(240, Math.round(sourceH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(mime, quality);
        URL.revokeObjectURL(url);
        resolve({ bytes: dataUrlToBytes(dataUrl), width, height });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(tr('pdf_image_error')));
    };
    img.src = url;
  });
}

function renderSvgToJpeg(svgText, maxWidth = 1500) {
  return renderSvgToImage(svgText, { maxWidth, mime: 'image/jpeg', quality: 0.92 });
}

function renderSvgToPng(svgText, maxWidth = 1800) {
  return renderSvgToImage(svgText, { maxWidth, mime: 'image/png', quality: 1 });
}

function buildPlanPdf(pages, imagePages = []) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const topY = 796;
  const lineHeight = 13;
  const objects = [
    '',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const pageObjectNumbers = [];

  const addTextPage = (currentLines) => {
    const content = [];
    let cursorY = topY;
    currentLines.forEach((line, index) => {
      const size = index === 0 && pageObjectNumbers.length === 0 ? 16 : 9;
      const leading = index === 0 && pageObjectNumbers.length === 0 ? 20 : lineHeight;
      content.push(`BT /F1 ${size} Tf 1 0 0 1 ${marginX} ${cursorY} Tm (${escapePdfString(line)}) Tj ET`);
      cursorY -= leading;
    });
    const stream = content.join('\n');
    const contentObj = objects.length + 1;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageObj = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`);
    pageObjectNumbers.push(pageObj);
  };

  pages.forEach((pageLines) => addTextPage(pageLines));

  const addImagePage = (title, image) => {
    if (!image?.bytes?.length) return;
    const imageObj = objects.length + 1;
    const hex = bytesToHex(image.bytes);
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`);
    const maxW = pageWidth - 60;
    const maxH = pageHeight - 90;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const drawX = (pageWidth - drawW) / 2;
    const drawY = (pageHeight - drawH) / 2 - 12;
    const stream = [
      `BT /F1 14 Tf 1 0 0 1 ${marginX} 806 Tm (${escapePdfString(title)}) Tj ET`,
      `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /PlanImage Do Q`,
    ].join('\n');
    const contentObj = objects.length + 1;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageObj = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << /PlanImage ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    pageObjectNumbers.push(pageObj);
  };

  imagePages.forEach(({ title, image }) => addImagePage(title, image));

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function collectPlanPdfPages() {
  const planPanel = root.querySelector('[data-panel="plan"]');
  const calcPanel = root.querySelector('[data-panel="calcs"]');
  const generatedAt = formatDateTime(new Date());
  const planStats = [];
  planPanel?.querySelectorAll('.stat-row').forEach((row) => {
    const label = row.querySelector('span')?.textContent || '';
    const value = row.querySelector('strong')?.textContent || '';
    planStats.push(`${label}: ${value}`);
  });
  const angleLines = [];
  calcPanel?.querySelectorAll('.stat-row').forEach((row) => {
    const label = row.querySelector('span')?.textContent || '';
    const value = row.querySelector('strong')?.textContent || '';
    if (/pente|angle|retrait|coupe|biseau|lame|trait|slope|inset|cut|bevel|kerf/i.test(label)) {
      angleLines.push(`${label}: ${value}`);
    }
  });
  const pages = [];
  calcPanel?.querySelectorAll('.cut-row').forEach((row, index) => {
    const name = row.querySelector('span')?.textContent || '';
    const qty = row.querySelector('strong')?.textContent || '';
    const dims = row.querySelector('small')?.textContent || '';
    const note = row.querySelector('em')?.textContent || '';
    const page = [
      tr('plan_piece_title', { index: index + 1, name }),
      tr('generated_at', { date: generatedAt }),
      '',
      tr('identification'),
      `${tr('name')}: ${name}`,
      `${tr('quantity')}: ${qty}`,
      `${tr('dimensions')}: ${dims}`,
      `${tr('piece_cuts')}: ${note || tr('default_piece_cut')}`,
      '',
      tr('model_angles'),
      ...angleLines,
      '',
      tr('cut_plan_params'),
      ...planStats,
      '',
      tr('fabrication_note'),
      tr('fabrication_note_body'),
    ];
    pages.push(page.flatMap((line) => wrapPdfLine(line)));
  });
  if (!pages.length) {
    pages.push([
      tr('cut_plan_title'),
      tr('generated_at', { date: generatedAt }),
      '',
      tr('no_piece_found'),
    ]);
  }
  return pages;
}

function collectPlanPieces() {
  const calcPanel = root.querySelector('[data-panel="calcs"]');
  const pieces = [];
  Array.from(calcPanel?.querySelectorAll('.cut-row') || []).forEach((row) => {
    const rawName = row.querySelector('span')?.textContent || '';
    const rawQty = Number.parseInt(row.querySelector('strong')?.textContent || '1', 10);
    const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
    const dims = row.querySelector('small')?.textContent || '';
    const note = row.querySelector('em')?.textContent || '';
    const normalized = cleanPdfText(rawName).toLowerCase();
    let names = [rawName];
    if ((normalized === 'facade' || normalized === 'façade') && qty >= 2) names = [tr('front_façade'), tr('back_façade')];
    else if ((normalized === 'cote' || normalized === 'côté' || normalized === 'side') && qty >= 2) names = [tr('left_side'), tr('right_side')];
    else if ((normalized === 'toit' || normalized === 'roof') && qty >= 2) names = [tr('left_roof'), tr('right_roof')];
    else if (qty > 1) names = Array.from({ length: qty }, (_, i) => `${rawName} ${i + 1}`);
    names.forEach((name) => {
      pieces.push({
        index: pieces.length,
        name,
        qty: '1',
        dims,
        note,
        sourceName: rawName,
      });
    });
  });
  return pieces.map((piece, index) => ({ ...piece, index }));
}

function collectAngleLines() {
  const calcPanel = root.querySelector('[data-panel="calcs"]');
  return Array.from(calcPanel?.querySelectorAll('.stat-row') || [])
    .map((row) => ({
      label: row.querySelector('span')?.textContent || '',
      value: row.querySelector('strong')?.textContent || '',
    }))
    .filter((item) => /pente|angle|retrait|coupe|biseau|lame|trait|slope|inset|cut|bevel|kerf/i.test(item.label))
    .map((item) => `${item.label}: ${item.value}`);
}

function drawWrappedCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = cleanPdfText(text).split(' ').filter(Boolean);
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  });
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function renderPieceCard(piece, angleLines, mime = 'image/jpeg') {
  const canvas = document.createElement('canvas');
  canvas.width = 1700;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#b56f18';
  ctx.lineWidth = 5;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  ctx.fillStyle = '#24211d';
  ctx.font = 'bold 44px monospace';
  ctx.fillText(cleanPdfText(tr('piece_card_title', { index: piece.index + 1, name: piece.name })), 70, 105);
  ctx.font = '24px monospace';
  ctx.fillStyle = '#6d6255';
  ctx.fillText(`${cleanPdfText(tr('quantity'))}: ${cleanPdfText(piece.qty)}`, 70, 150);
  ctx.fillText(`${cleanPdfText(tr('dimensions'))}: ${cleanPdfText(piece.dims)}`, 70, 190);

  const shapeX = 90;
  const shapeY = 280;
  const shapeW = 760;
  const shapeH = 500;
  const normalizedName = cleanPdfText(piece.name).toLowerCase();
  ctx.fillStyle = '#d4a574';
  ctx.strokeStyle = '#7b4308';
  ctx.lineWidth = 4;
  if (/facade|façade/.test(normalizedName)) {
    ctx.beginPath();
    ctx.moveTo(shapeX, shapeY + shapeH);
    ctx.lineTo(shapeX + shapeW, shapeY + shapeH);
    ctx.lineTo(shapeX + shapeW, shapeY + shapeH * 0.35);
    ctx.lineTo(shapeX + shapeW / 2, shapeY);
    ctx.lineTo(shapeX, shapeY + shapeH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (/avant|front/.test(normalizedName) && params.door !== 'none') {
      const holeX = shapeX + shapeW * (Number(params.doorPX || 50) / 100);
      const holeY = shapeY + shapeH * (1 - Number(params.doorPY || 50) / 100);
      const holeW = Math.max(42, Math.min(shapeW * 0.42, Number(params.doorW || 38) * 4.2));
      const holeH = Math.max(42, Math.min(shapeH * 0.48, Number(params.doorH || 38) * 4.2));
      ctx.save();
      ctx.fillStyle = '#fffaf1';
      ctx.strokeStyle = '#24211d';
      ctx.lineWidth = 5;
      if (params.door === 'round') {
        ctx.beginPath();
        ctx.ellipse(holeX, holeY, holeW / 2, holeH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (params.door === 'pentagon') {
        ctx.beginPath();
        ctx.moveTo(holeX - holeW / 2, holeY + holeH / 2);
        ctx.lineTo(holeX + holeW / 2, holeY + holeH / 2);
        ctx.lineTo(holeX + holeW / 2, holeY - holeH * 0.12);
        ctx.lineTo(holeX, holeY - holeH / 2);
        ctx.lineTo(holeX - holeW / 2, holeY - holeH * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(holeX - holeW / 2, holeY - holeH / 2, holeW, holeH);
        ctx.strokeRect(holeX - holeW / 2, holeY - holeH / 2, holeW, holeH);
      }
      if (params.perch) {
        const perchY = holeY + holeH / 2 + Math.max(28, Number(params.perchOff || 15) * 2.2);
        ctx.beginPath();
        ctx.ellipse(holeX, perchY, 28, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (/perchoir|perch/.test(normalizedName)) {
    ctx.beginPath();
    ctx.roundRect(shapeX, shapeY + shapeH * 0.38, shapeW, shapeH * 0.24, 80);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(shapeX, shapeY, shapeW, shapeH);
    ctx.strokeRect(shapeX, shapeY, shapeW, shapeH);
  }

  ctx.strokeStyle = '#24211d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shapeX, shapeY + shapeH + 40);
  ctx.lineTo(shapeX + shapeW, shapeY + shapeH + 40);
  ctx.moveTo(shapeX, shapeY + shapeH + 30);
  ctx.lineTo(shapeX, shapeY + shapeH + 50);
  ctx.moveTo(shapeX + shapeW, shapeY + shapeH + 30);
  ctx.lineTo(shapeX + shapeW, shapeY + shapeH + 50);
  ctx.stroke();

  ctx.fillStyle = '#24211d';
  ctx.font = '24px monospace';
  ctx.fillText(cleanPdfText(piece.dims), shapeX + 10, shapeY + shapeH + 76);
  ctx.font = '18px monospace';
  ctx.fillStyle = '#6d6255';
  ctx.fillText(cleanPdfText(tr('indicative_diagram')), shapeX, shapeY + shapeH + 112);

  const textX = 960;
  const textWidth = 620;
  let y = 280;
  ctx.fillStyle = '#24211d';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(cleanPdfText(tr('cuts_and_angles')), textX, y);
  y += 42;
  ctx.font = '23px monospace';
  y = drawWrappedCanvasText(ctx, piece.note || tr('default_piece_cut'), textX, y, textWidth, 32);
  y += 24;
  ctx.font = 'bold 24px monospace';
  ctx.fillText(cleanPdfText(tr('model_angles_short')), textX, y);
  y += 36;
  ctx.font = '19px monospace';
  angleLines.slice(0, 10).forEach((line) => {
    y = drawWrappedCanvasText(ctx, line, textX, y, textWidth, 26);
  });

  return {
    bytes: dataUrlToBytes(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.92 : 1)),
    width: canvas.width,
    height: canvas.height,
  };
}

function renderExplosionImage(mime = 'image/png') {
  const exportParams = { ...params, explode: Math.max(Number(params.explode || 0), 72), mode: 'solid' };
  const payload = parseResponse(scene_meshes_json(JSON.stringify(exportParams)));
  if (!payload?.meshes?.length) throw new Error(tr('exploded_mesh_missing'));

  const width = 1600;
  const height = 1100;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fffaf1');
  const camera = new THREE.PerspectiveCamera(38, width / height, 1, 6000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff4df, 1.0);
  key.position.set(360, 520, 340);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcecff, 0.45);
  fill.position.set(-320, 220, -360);
  scene.add(fill);

  const group = new THREE.Group();
  const disposables = [];
  const labelPoints = [];
  payload.meshes.forEach((m) => {
    if (!m.vertices || m.vertices.length < 9) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.vertices, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(m.color || '#d4a574'),
      side: THREE.DoubleSide,
      shininess: 18,
      specular: 0x222222,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    const edges = new THREE.EdgesGeometry(geo, 18);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6b4320 }));
    group.add(line);
    const meshBox = new THREE.Box3().setFromObject(mesh);
    labelPoints.push({
      name: m.name || m.key || 'piece',
      point: meshBox.getCenter(new THREE.Vector3()),
    });
    disposables.push(geo, mat, edges, line.material);
  });
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  group.position.sub(center);
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  camera.position.set(maxSize * 1.1, maxSize * 0.85, maxSize * 1.55);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.font = 'bold 30px monospace';
  ctx.textBaseline = 'middle';
  labelPoints.forEach((item) => {
    const p = item.point.clone().add(group.position).project(camera);
    const x = (p.x * 0.5 + 0.5) * width;
    const y = (-p.y * 0.5 + 0.5) * height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const label = cleanPdfText(item.name);
    const metrics = ctx.measureText(label);
    const padX = 10;
    const boxW = metrics.width + padX * 2;
    const boxH = 38;
    const bx = Math.max(8, Math.min(width - boxW - 8, x - boxW / 2));
    const by = Math.max(8, Math.min(height - boxH - 8, y - 24));
    ctx.fillStyle = 'rgba(255, 250, 241, 0.86)';
    ctx.strokeStyle = '#b56f18';
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#24211d';
    ctx.fillText(label, bx + padX, by + boxH / 2);
  });
  const dataUrl = canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.92 : 1);
  disposables.forEach((item) => item.dispose && item.dispose());
  renderer.dispose();
  return { bytes: dataUrlToBytes(dataUrl), width, height };
}

async function downloadPlanPdf() {
  try {
    const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
    if (!payload?.svg) {
      setExportStatus(tr('plan_pdf_empty'), 'warn');
      return false;
    }
    const planImage = await renderSvgToJpeg(payload.svg);
    const angleLines = collectAngleLines();
    const pieceImages = collectPlanPieces().map((piece) => ({
      title: tr('piece_card_title', { index: piece.index + 1, name: piece.name }),
      image: renderPieceCard(piece, angleLines, 'image/jpeg'),
    }));
    const explosionImage = renderExplosionImage('image/jpeg');
    const pdf = buildPlanPdf([], [
      ...pieceImages,
      { title: tr('exploded_assembly'), image: explosionImage },
      { title: tr('cut_plan_title'), image: planImage },
    ]);
    const filename = exportFilename('plan_pdf');
    download(pdf, filename, 'application/pdf');
    setExportStatus(tr('file_created_named', { filename }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
    return false;
  }
}

async function downloadPlanPng() {
  try {
    const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
    if (!payload?.svg) {
      setExportStatus(tr('plan_png_empty'), 'warn');
      return false;
    }
    const image = await renderSvgToPng(payload.svg);
    const filename = exportFilename('plan_png');
    download(image.bytes, filename, 'image/png');
    setExportStatus(tr('file_created_named', { filename }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
    return false;
  }
}

function downloadExplosionPng() {
  try {
    const image = renderExplosionImage('image/png');
    const filename = exportFilename('explosion_png');
    download(image.bytes, filename, 'image/png');
    setExportStatus(tr('file_created_named', { filename }), 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
    return false;
  }
}

function exportText(filename, type, producer, emptyMessage) {
  try {
    const text = producer();
    if (!text || !String(text).length) {
      setExportStatus(emptyMessage, 'warn');
      return;
    }
    download(String(text), filename, type);
    setExportStatus(tr('file_created_simple_chars', { filename, size: formatCountText(String(text).length) }), 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(tr('export_error', { error: err?.message || err }), 'error');
  }
}

function parseResponse(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj && obj.ok ? obj.payload : null;
  } catch {
    return null;
  }
}

function captureUiState() {
  const scroller = root.querySelector('.tab-scroll');
  const accountModal = root.querySelector('[data-account-modal]');
  const active = document.activeElement;
  const focus = active && active.dataset ? {
    param: active.dataset.param || null,
    paramNumber: active.dataset.paramNumber || null,
    decoParam: active.dataset.decoParam || null,
    decoNumber: active.dataset.decoNumber || null,
    choice: active.dataset.choice || null,
    bool: active.dataset.bool || null,
    decoBool: active.dataset.decoBool || null,
    decoTarget: active.hasAttribute('data-deco-target'),
    panelPreset: active.hasAttribute('data-panel-preset'),
  } : null;
  return {
    scrollTop: scroller ? scroller.scrollTop : 0,
    modalOpen: Boolean(accountModal && !accountModal.hidden),
    focus,
  };
}

function restoreUiState(state) {
  if (!state) return;
  const scroller = root.querySelector('.tab-scroll');
  if (scroller) scroller.scrollTop = state.scrollTop || 0;
  if (!state.focus) return;

  let selector = null;
  if (state.focus.param) selector = `[data-param="${state.focus.param}"]`;
  if (state.focus.paramNumber) selector = `[data-param-number="${state.focus.paramNumber}"]`;
  if (state.focus.decoParam) selector = `[data-deco-param="${state.focus.decoParam}"]`;
  if (state.focus.decoNumber) selector = `[data-deco-number="${state.focus.decoNumber}"]`;
  if (state.focus.choice) selector = `[data-choice="${state.focus.choice}"]`;
  if (state.focus.bool) selector = `[data-bool="${state.focus.bool}"]`;
  if (state.focus.decoBool) selector = `[data-deco-bool="${state.focus.decoBool}"]`;
  if (state.focus.decoTarget) selector = '[data-deco-target]';
  if (state.focus.panelPreset) selector = '[data-panel-preset]';
  const target = selector ? root.querySelector(selector) : null;
  if (target && typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

function syncRangeControl(key, value) {
  const control = root.querySelector(`[data-param="${key}"]`)?.closest('.range-control')
    || root.querySelector(`[data-param-number="${key}"]`)?.closest('.range-control');
  if (!control) return;
  const range = control.querySelector(`[data-param="${key}"]`);
  const number = control.querySelector(`[data-param-number="${key}"]`);
  if (range) range.value = String(value);
  if (number) number.value = String(value);
}

function valueToParam(input) {
  const scale = Number(input.dataset.paramScale || 1);
  return Number(input.value) * (Number.isFinite(scale) ? scale : 1);
}

function decoValueToParam(input) {
  const scale = Number(input.dataset.decoScale || 1);
  return Number(input.value) * (Number.isFinite(scale) ? scale : 1);
}

function ensureDecos() {
  if (!params.panelPreset) params.panelPreset = 'auto';
  if (!params.thicknessPreset) params.thicknessPreset = '12';
  if (!params.decos || typeof params.decos !== 'object') params.decos = {};
  DECO_TARGET_KEYS.forEach((key) => {
    if (!params.decos[key]) {
      params.decos[key] = {
        enabled: false,
        sourceType: '',
        sourceText: '',
        sourceData: '',
        sourceName: '',
        sourceBytes: 0,
        mode: 'heightmap',
        w: 60,
        h: 60,
        posX: 50,
        posY: 50,
        rotation: 0,
        depth: 2,
        bevel: 0,
        smooth: 25,
        threshold: 2,
        invert: false,
        resolution: 64,
        removeBg: false,
        clipToPanel: true,
        lockProportions: false,
      };
    }
    if (params.decos[key].smooth === undefined) params.decos[key].smooth = 25;
    if (params.decos[key].threshold === undefined) params.decos[key].threshold = 2;
    if (params.decos[key].removeBg === undefined) params.decos[key].removeBg = false;
    if (params.decos[key].clipToPanel === undefined) params.decos[key].clipToPanel = true;
    if (params.decos[key].lockProportions === undefined) params.decos[key].lockProportions = false;
    if (params.decos[key].sourceName === undefined) params.decos[key].sourceName = '';
    if (params.decos[key].sourceBytes === undefined) params.decos[key].sourceBytes = 0;
    if (params.decos[key].sourceType === 'stl') {
      params.decos[key].mode = 'stl';
    }
    if (!params.decos[key].sourceData && params.decos[key].sourceType !== 'svg') {
      params.decos[key].mode = 'heightmap';
    }
  });
  if (!params.decorActive || !params.decos[params.decorActive]) params.decorActive = 'front';
}

function activeDeco() {
  ensureDecos();
  return params.decos[params.decorActive];
}

function syncDecoControl(key, value) {
  const control = root.querySelector(`[data-deco-param="${key}"]`)?.closest('.range-control')
    || root.querySelector(`[data-deco-number="${key}"]`)?.closest('.range-control');
  if (!control) return;
  const range = control.querySelector(`[data-deco-param="${key}"]`);
  const number = control.querySelector(`[data-deco-number="${key}"]`);
  if (range) range.value = String(value);
  if (number) number.value = String(value);
}

function syncDecoControlToParam(key, value) {
  const control = root.querySelector(`[data-deco-param="${key}"]`)?.closest('.range-control')
    || root.querySelector(`[data-deco-number="${key}"]`)?.closest('.range-control');
  if (!control) return;
  const input = control.querySelector(`[data-deco-param="${key}"]`)
    || control.querySelector(`[data-deco-number="${key}"]`);
  const scale = Number(input?.dataset?.decoScale || 1);
  const displayValue = Number(value) / (Number.isFinite(scale) && scale > 0 ? scale : 1);
  syncDecoControl(key, displayValue);
}

function applyDecoDimensionValue(deco, key, nextValue) {
  if (!deco || !['w', 'h'].includes(key) || !Number.isFinite(nextValue)) return [key];
  if (!deco.lockProportions) {
    deco[key] = Math.max(DECO_SIZE_MIN_MM, Math.min(DECO_SIZE_MAX_MM, nextValue));
    return [key];
  }

  const otherKey = key === 'w' ? 'h' : 'w';
  const current = Number(deco[key]);
  const other = Number(deco[otherKey]);
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(other) || other <= 0) {
    deco[key] = Math.max(DECO_SIZE_MIN_MM, Math.min(DECO_SIZE_MAX_MM, nextValue));
    return [key];
  }

  let factor = nextValue / current;
  if (!Number.isFinite(factor) || factor <= 0) factor = 1;
  const minFactor = Math.max(DECO_SIZE_MIN_MM / current, DECO_SIZE_MIN_MM / other);
  const maxFactor = Math.min(DECO_SIZE_MAX_MM / current, DECO_SIZE_MAX_MM / other);
  factor = Math.max(minFactor, Math.min(maxFactor, factor));
  deco[key] = current * factor;
  deco[otherKey] = other * factor;
  return [key, otherKey];
}

function setDecoNumericParam(deco, key, value) {
  if (['w', 'h'].includes(key)) {
    return applyDecoDimensionValue(deco, key, value);
  }
  deco[key] = value;
  return [key];
}

function normalizeDependentParams(changedKey) {
  if (changedKey === 'slope' && Math.abs(Number(params.slope) - 45) > 0.001) {
    params.ridge = 'miter';
  }
}

function refreshGeneratedViews() {
  renderPlanPreview();
  renderViewer();
  saveMeshReportToBrowser();
}

async function refreshDecoRasterIfNeeded(deco) {
  if (!deco || deco.sourceType !== 'svg' || !deco.sourceText) return;
  const size = decoRasterSize(deco);
  deco.sourceText = assertSafeSvgText(deco.sourceText);
  deco.sourceData = await rasterizeSvgToPngBase64(deco.sourceText, size);
}

function decoPreviewSrc(deco) {
  if (!decoHasHeightmapSource(deco)) return '';
  const mime = DECO_PREVIEW_MIME_TYPES[deco.sourceType] || 'image/png';
  return `data:${mime};base64,${deco.sourceData}`;
}

function updateDecoUploadUi() {
  const deco = activeDeco();
  const hasSource = decoHasSource(deco);
  const preview = root.querySelector('[data-deco-preview]');
  const dropzone = root.querySelector('[data-deco-dropzone]');
  const fileName = root.querySelector('[data-deco-file-name]');
  const fileMeta = root.querySelector('[data-deco-file-meta]');
  if (dropzone) {
    dropzone.classList.toggle('has-source', hasSource);
    dropzone.classList.toggle('is-empty', !hasSource);
  }
  if (preview) {
    preview.replaceChildren();
    if (hasSource && deco.sourceType === 'stl') {
      const label = document.createElement('span');
      label.textContent = tr('decor_stl_preview');
      preview.appendChild(label);
    } else if (hasSource) {
      const img = document.createElement('img');
      img.src = decoPreviewSrc(deco);
      img.alt = tr('decor_preview_alt');
      preview.appendChild(img);
    } else {
      const empty = document.createElement('span');
      empty.textContent = tr('decor_preview_empty');
      preview.appendChild(empty);
    }
  }
  if (fileName) {
    fileName.textContent = deco.sourceName || (hasSource ? deco.sourceType.toUpperCase() : '');
  }
  if (fileMeta) {
    const size = Number(deco.sourceBytes || 0);
    const sizeLabel = size > 0 && size < 1024 ? '< 1 Ko' : `${Math.round(size / 1024)} Ko`;
    fileMeta.textContent = hasSource
      ? [deco.sourceType?.toUpperCase(), size > 0 ? sizeLabel : ''].filter(Boolean).join(' · ')
      : DECO_ACCEPT.replaceAll(',', ', ');
  }
}

function disposeViewerObjects(state) {
  if (state.group) {
    state.scene.remove(state.group);
    state.group = null;
  }
  state.disposables.forEach((item) => item.dispose && item.dispose());
  state.disposables = [];
}

function updateViewerCamera(state) {
  const phi = Math.max(0.18, Math.min(Math.PI - 0.18, cameraState.phi));
  const x = cameraState.dist * Math.sin(phi) * Math.sin(cameraState.theta);
  const y = cameraState.dist * Math.cos(phi);
  const z = cameraState.dist * Math.sin(phi) * Math.cos(cameraState.theta);
  state.camera.position.set(
    cameraState.target.x + x,
    cameraState.target.y + y,
    cameraState.target.z + z,
  );
  state.camera.lookAt(cameraState.target);
}

function resizeViewer(state) {
  if (!state.mount) return;
  const rect = state.mount.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(260, Math.floor(rect.height));
  if (state.width === width && state.height === height) return;
  state.width = width;
  state.height = height;
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  state.renderer.setSize(width, height);
}

function animateViewer(state) {
  if (viewerState !== state) return;
  resizeViewer(state);
  updateViewerCamera(state);
  state.renderer.render(state.scene, state.camera);
  frameId = requestAnimationFrame(() => animateViewer(state));
}

function bindViewerMount(state, mount) {
  if (state.mount === mount && state.renderer.domElement.parentElement === mount) return;
  if (state.unbindMount) {
    state.unbindMount();
    state.unbindMount = null;
  }
  state.mount = mount;
  mount.textContent = '';
  mount.appendChild(state.renderer.domElement);

  const onPointerDown = (event) => {
    state.dragging = true;
    state.panMode = event.shiftKey || event.button === 1 || event.button === 2;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    mount.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    if (state.panMode) {
      cameraState.target.x -= dx * 0.5;
      cameraState.target.y += dy * 0.5;
    } else {
      cameraState.theta -= dx * 0.008;
      cameraState.phi += dy * 0.008;
    }
    updateViewerCamera(state);
  };
  const endDrag = (event) => {
    state.dragging = false;
    if (mount.hasPointerCapture?.(event.pointerId)) {
      mount.releasePointerCapture(event.pointerId);
    }
  };
  const onContextMenu = (event) => event.preventDefault();
  const onWheel = (event) => {
    event.preventDefault();
    cameraState.dist = Math.max(160, Math.min(1800, cameraState.dist + event.deltaY * 0.65));
    updateViewerCamera(state);
  };

  mount.addEventListener('pointerdown', onPointerDown);
  mount.addEventListener('pointermove', onPointerMove);
  mount.addEventListener('pointerup', endDrag);
  mount.addEventListener('pointercancel', endDrag);
  mount.addEventListener('contextmenu', onContextMenu);
  mount.addEventListener('wheel', onWheel, { passive: false });

  state.unbindMount = () => {
    mount.removeEventListener('pointerdown', onPointerDown);
    mount.removeEventListener('pointermove', onPointerMove);
    mount.removeEventListener('pointerup', endDrag);
    mount.removeEventListener('pointercancel', endDrag);
    mount.removeEventListener('contextmenu', onContextMenu);
    mount.removeEventListener('wheel', onWheel);
  };
  resizeViewer(state);
}

function createViewerState() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.DirectionalLight(0xfff4df, 0.9);
  key.position.set(300, 420, 260);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcecff, 0.35);
  fill.position.set(-260, 180, -260);
  scene.add(fill);

  const state = {
    scene,
    camera,
    renderer,
    mount: null,
    unbindMount: null,
    group: null,
    disposables: [],
    width: 0,
    height: 0,
    dragging: false,
    panMode: false,
    lastX: 0,
    lastY: 0,
  };
  frameId = requestAnimationFrame(() => animateViewer(state));
  return state;
}

function disposeViewerState() {
  if (frameId) cancelAnimationFrame(frameId);
  frameId = null;
  if (!viewerState) return;
  if (viewerState.unbindMount) viewerState.unbindMount();
  disposeViewerObjects(viewerState);
  viewerState.renderer.dispose();
  viewerState = null;
}

function meshBoundsSummary(vertices) {
  if (!vertices || vertices.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    const x = Number(vertices[i]);
    const y = Number(vertices[i + 1]);
    const z = Number(vertices[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return null;
  const round = (value) => Math.round(value * 100) / 100;
  return {
    min: [round(minX), round(minY), round(minZ)],
    max: [round(maxX), round(maxY), round(maxZ)],
    size: [round(maxX - minX), round(maxY - minY), round(maxZ - minZ)],
  };
}

function smoothGeometryNormalsByPosition(geo) {
  const position = geo.getAttribute('position');
  if (!position || position.count < 3) {
    geo.computeVertexNormals();
    return;
  }
  const normals = new Float32Array(position.count * 3);
  const accum = new Map();
  const keyFor = (idx) => {
    const x = Math.round(position.getX(idx) * 1000);
    const y = Math.round(position.getY(idx) * 1000);
    const z = Math.round(position.getZ(idx) * 1000);
    return `${x},${y},${z}`;
  };
  const addNormal = (idx, nx, ny, nz) => {
    const key = keyFor(idx);
    const prev = accum.get(key);
    if (prev) {
      prev[0] += nx;
      prev[1] += ny;
      prev[2] += nz;
    } else {
      accum.set(key, [nx, ny, nz]);
    }
  };
  for (let i = 0; i + 2 < position.count; i += 3) {
    const ax = position.getX(i);
    const ay = position.getY(i);
    const az = position.getZ(i);
    const bx = position.getX(i + 1);
    const by = position.getY(i + 1);
    const bz = position.getZ(i + 1);
    const cx = position.getX(i + 2);
    const cy = position.getY(i + 2);
    const cz = position.getZ(i + 2);
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(len) || len <= 0) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    addNormal(i, nx, ny, nz);
    addNormal(i + 1, nx, ny, nz);
    addNormal(i + 2, nx, ny, nz);
  }
  for (let i = 0; i < position.count; i += 1) {
    const normal = accum.get(keyFor(i)) || [0, 0, 1];
    const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    normals[i * 3] = normal[0] / len;
    normals[i * 3 + 1] = normal[1] / len;
    normals[i * 3 + 2] = normal[2] / len;
  }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
}

function renderViewer() {
  const mount = document.getElementById('viewer');
  if (!mount) return;
  const active = params?.decorActive && params.decos ? params.decos[params.decorActive] : null;
  if (active?.sourceType === 'stl') {
    debugStlLog('renderViewer: active STL before WASM scene build', {
      target: params.decorActive,
      enabled: active.enabled,
      sourceName: active.sourceName,
      sourceBytes: active.sourceBytes,
      sourceDataChars: String(active.sourceData || '').length,
      w: active.w,
      h: active.h,
      depth: active.depth,
      posX: active.posX,
      posY: active.posY,
      rotation: active.rotation,
      clipToPanel: active.clipToPanel,
      viewMode: params.mode,
    });
  }
  const payload = parseResponse(scene_meshes_json(JSON.stringify(params)));
  if (!payload || !Array.isArray(payload.meshes)) {
    debugStlLog('renderViewer: invalid scene payload from WASM', {
      payload,
    });
    return;
  }
  const meshSummary = payload.meshes.map((mesh) => ({
    key: mesh.key,
    vertices: mesh.vertices?.length || 0,
    triangles: Math.floor((mesh.vertices?.length || 0) / 9),
    bounds: meshBoundsSummary(mesh.vertices),
  }));
  if (active?.sourceType === 'stl' || meshSummary.some((mesh) => String(mesh.key || '').startsWith('deco_'))) {
    debugStlLog('renderViewer: WASM scene meshes', {
      meshSummary,
      decorMeshes: meshSummary.filter((mesh) => String(mesh.key || '').startsWith('deco_')),
    });
  }

  if (!viewerState) {
    try {
      viewerState = createViewerState();
    } catch (err) {
      console.warn('viewer_unavailable', err);
      mount.innerHTML = '';
      const fallback = document.createElement('div');
      fallback.className = 'viewer-fallback';
      fallback.textContent = tr('viewer_unavailable');
      mount.appendChild(fallback);
      return;
    }
  }

  bindViewerMount(viewerState, mount);
  const css = getComputedStyle(document.body);
  const viewerBg = css.getPropertyValue('--viewer-bg').trim() || '#13151c';
  const edgeColor = css.getPropertyValue('--edge').trim() || '#2a1e15';
  viewerState.scene.background = new THREE.Color(viewerBg);
  disposeViewerObjects(viewerState);

  const group = new THREE.Group();
  viewerState.scene.add(group);
  viewerState.group = group;
  const disposables = [];

  payload.meshes.forEach((m) => {
    if (!m.vertices || m.vertices.length < 9) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.vertices, 3));
    const edgesOnly = params.mode === 'edges';
    const meshKey = String(m.key || '');
    const isFacade = meshKey === 'front' || meshKey === 'back';
    const isDecor = meshKey.startsWith('deco_');
    if (isDecor) {
      smoothGeometryNormalsByPosition(geo);
    } else {
      geo.computeVertexNormals();
    }
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(m.color || '#d4a574'),
      side: THREE.DoubleSide,
      wireframe: params.mode === 'wireframe',
      transparent: params.mode === 'xray',
      opacity: params.mode === 'xray' ? 0.28 : 1,
      depthWrite: params.mode !== 'xray',
      visible: !edgesOnly,
      shininess: 22,
      specular: 0x222222,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo, mat);

    if ((isFacade || isDecor) && !edgesOnly) return;
    const edges = new THREE.EdgesGeometry(geo, 18);
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: edgesOnly ? 0xd4a574 : edgeColor,
      transparent: params.mode === 'xray',
      opacity: params.mode === 'xray' ? 0.62 : 1,
    }));
    group.add(lines);
    disposables.push(edges, lines.material);
  });
  viewerState.disposables = disposables;

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
  updateViewerCamera(viewerState);
  viewerState.renderer.render(viewerState.scene, viewerState.camera);
}

function updateTabs() {
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeTab);
  });
  root.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === activeTab);
  });
}

function bindTabs() {
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      updateTabs();
      renderPlanPreview();
    });
  });
  updateTabs();
}

function renderPlanPreview() {
  const target = document.getElementById('plan-preview');
  if (!target) return;
  const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
  target.innerHTML = payload && payload.svg ? payload.svg : '';
  saveMeshReportToBrowser();
}

function render() {
  const uiState = captureUiState();
  setDocumentLanguage();
  ensureDecos();
  root.innerHTML = render_app_html(JSON.stringify(params));
  applyTheme();
  attachDecorLibraryPanel();

  const accountModal = root.querySelector('[data-account-modal]');
  const accountOpenButton = root.querySelector('[data-action="account-modal-open"]');
  const closeAccountModal = () => {
    if (!accountModal || accountModal.hidden) return;
    accountModal.classList.remove('is-open');
    accountModal.hidden = true;
    modalWasOpen = false;
    if (lastAccountFocus && document.contains(lastAccountFocus)) lastAccountFocus.focus();
  };
  const openAccountModal = () => {
    if (!accountModal) return;
    lastAccountFocus = document.activeElement;
    accountModal.hidden = false;
    accountModal.classList.add('is-open');
    modalWasOpen = true;
    refreshAccountState({ silent: true });
    accountModal.querySelector('.account-sheet')?.focus({ preventScroll: true });
  };
  accountOpenButton?.addEventListener('click', openAccountModal);
  accountModal?.querySelectorAll('[data-account-modal-close]').forEach((button) => {
    button.addEventListener('click', closeAccountModal);
  });
  accountModal?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAccountModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(accountModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  root.querySelector('[data-action="account-login"]')?.addEventListener('click', () => {
    loginAccount();
  });
  root.querySelectorAll('[data-action="account-refresh"]').forEach((button) => {
    button.addEventListener('click', () => {
      refreshAccountState();
    });
  });
  root.querySelector('[data-action="account-logout"]')?.addEventListener('click', () => {
    logoutAccount();
  });
  root.querySelectorAll('[data-site-link]').forEach((link) => {
    const path = link.dataset.siteLink || '/';
    link.href = phpUrl(path);
  });
  root.querySelector('[data-account-ticket-list]')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-account-ticket-open]');
    if (!button) return;
    try {
      await loadAccountTicketDetail(button.dataset.accountTicketOpen);
    } catch (err) {
      accountState.error = tr('ticket_error', { error: err?.message || err });
      updateAccountDom();
    }
  });
  root.querySelector('[data-account-ticket-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const payload = await apiRequest('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject: data.get('subject'), body: data.get('body') }),
      });
      event.currentTarget.reset();
      selectedAccountTicketId = payload.ticket_id || null;
      await loadAccountTickets({ openFirst: true });
      setExportStatus(tr('ticket_created'), 'ok');
    } catch (err) {
      accountState.error = tr('ticket_denied', { error: err?.message || err });
      updateAccountDom();
    }
  });
  root.querySelector('[data-account-ticket-reply-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedAccountTicketId) return;
    const data = new FormData(event.currentTarget);
    try {
      const payload = await apiRequest(`/api/tickets/${selectedAccountTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: data.get('body') }),
      });
      event.currentTarget.reset();
      renderAccountTicketDetail(payload);
      await loadAccountTickets();
      setExportStatus(tr('ticket_reply_sent'), 'ok');
    } catch (err) {
      accountState.error = tr('ticket_reply_denied', { error: err?.message || err });
      updateAccountDom();
    }
  });
  root.querySelector('[data-action="account-ticket-toggle"]')?.addEventListener('click', async () => {
    if (!accountTicketDetail?.ticket || !selectedAccountTicketId) return;
    const status = accountTicketDetail.ticket.status === 'open' ? 'closed' : 'open';
    try {
      const payload = await apiRequest(`/api/tickets/${selectedAccountTicketId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      renderAccountTicketDetail(payload);
      await loadAccountTickets();
      setExportStatus(status === 'open' ? tr('ticket_reopened') : tr('ticket_closed'), 'ok');
    } catch (err) {
      accountState.error = tr('ticket_status_denied', { error: err?.message || err });
      updateAccountDom();
    }
  });
  [
    ['token-pricing', tr('pricing_info')],
  ].forEach(([action, message]) => {
    root.querySelector(`[data-action="${action}"]`)?.addEventListener('click', () => {
      setExportStatus(message, 'info');
    });
  });
  root.querySelectorAll('[data-action="lang-switch"]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = normalizeLang(button.dataset.lang);
      params.lang = next;
      localStorage.setItem(LANG_KEY, next);
      render();
    });
  });

  root.querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.dataset.param === 'panelW' || input.dataset.param === 'panelH') params.panelPreset = 'custom';
      if (input.dataset.param === 'T') params.thicknessPreset = 'custom';
      params[input.dataset.param] = valueToParam(input);
      normalizeDependentParams(input.dataset.param);
      syncRangeControl(input.dataset.param, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      if (input.dataset.param === 'panelW' || input.dataset.param === 'panelH') params.panelPreset = 'custom';
      if (input.dataset.param === 'T') params.thicknessPreset = 'custom';
      params[input.dataset.param] = valueToParam(input);
      normalizeDependentParams(input.dataset.param);
      syncRangeControl(input.dataset.param, input.value);
      render();
    });
  });

  root.querySelectorAll('[data-param-number]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = valueToParam(input);
      if (!Number.isFinite(value)) return;
      if (input.dataset.paramNumber === 'panelW' || input.dataset.paramNumber === 'panelH') params.panelPreset = 'custom';
      if (input.dataset.paramNumber === 'T') params.thicknessPreset = 'custom';
      params[input.dataset.paramNumber] = value;
      normalizeDependentParams(input.dataset.paramNumber);
      syncRangeControl(input.dataset.paramNumber, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const value = valueToParam(input);
      if (!Number.isFinite(value)) return;
      if (input.dataset.paramNumber === 'panelW' || input.dataset.paramNumber === 'panelH') params.panelPreset = 'custom';
      if (input.dataset.paramNumber === 'T') params.thicknessPreset = 'custom';
      params[input.dataset.paramNumber] = value;
      normalizeDependentParams(input.dataset.paramNumber);
      syncRangeControl(input.dataset.paramNumber, input.value);
      render();
    });
  });

  root.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      params[button.dataset.choice] = button.dataset.value;
      render();
    });
  });

  root.querySelectorAll('[data-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      params[input.dataset.bool] = input.checked;
      render();
    });
  });

  root.querySelector('[data-deco-target]')?.addEventListener('change', (event) => {
    ensureDecos();
    params.decorActive = event.target.value;
    render();
  });

  root.querySelectorAll('[data-deco-param]').forEach((input) => {
    input.addEventListener('input', () => {
      const deco = activeDeco();
      const key = input.dataset.decoParam;
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const changedKeys = setDecoNumericParam(deco, key, value);
      changedKeys.forEach((changedKey) => syncDecoControlToParam(changedKey, deco[changedKey]));
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const deco = activeDeco();
      const key = input.dataset.decoParam;
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const changedKeys = setDecoNumericParam(deco, key, value);
      changedKeys.forEach((changedKey) => syncDecoControlToParam(changedKey, deco[changedKey]));
      if (key === 'resolution') {
        refreshDecoRasterIfNeeded(deco).finally(() => render());
      } else {
        render();
      }
    });
  });

  root.querySelectorAll('[data-deco-number]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const deco = activeDeco();
      const key = input.dataset.decoNumber;
      const changedKeys = setDecoNumericParam(deco, key, value);
      changedKeys.forEach((changedKey) => syncDecoControlToParam(changedKey, deco[changedKey]));
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const deco = activeDeco();
      const key = input.dataset.decoNumber;
      const changedKeys = setDecoNumericParam(deco, key, value);
      changedKeys.forEach((changedKey) => syncDecoControlToParam(changedKey, deco[changedKey]));
      if (key === 'resolution') {
        refreshDecoRasterIfNeeded(deco).finally(() => render());
      } else {
        render();
      }
    });
  });

  root.querySelectorAll('[data-deco-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const deco = activeDeco();
      deco[button.dataset.decoChoice] = button.dataset.value;
      render();
    });
  });

  root.querySelectorAll('[data-deco-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      const deco = activeDeco();
      if (input.dataset.decoBool === 'enabled' && input.checked && !decoHasSource(deco)) {
        input.checked = false;
        deco.enabled = false;
        setDecoStatus(tr('decor_upload_first'), 'warn');
        updateDecoUploadUi();
        return;
      }
      deco[input.dataset.decoBool] = input.checked;
      render();
    });
  });

  root.querySelector('[data-deco-file]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadDecoFile(file);
    event.target.value = '';
  });

  const decoDropzone = root.querySelector('[data-deco-dropzone]');
  if (decoDropzone) {
    ['dragenter', 'dragover'].forEach((type) => {
      decoDropzone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        decoDropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      decoDropzone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        decoDropzone.classList.remove('is-dragover');
      });
    });
    decoDropzone.addEventListener('drop', async (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      await loadDecoFile(file);
    });
  }

  root.querySelector('[data-deco-reload]')?.addEventListener('click', () => {
    root.querySelector('[data-deco-file]')?.click();
  });

  root.querySelector('[data-deco-clear]')?.addEventListener('click', () => {
    const deco = activeDeco();
    resetDecoSource(deco);
    render();
  });

  root.querySelector('[data-panel-preset]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value) return;
    params.panelPreset = value;
    if (value === 'auto' || value === 'custom') {
      render();
      return;
    }
    const [w, h] = value.split('x').map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    params.panelW = w;
    params.panelH = h;
    render();
  });

  root.querySelector('[data-thickness-preset]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value) return;
    params.thicknessPreset = value;
    if (value === 'custom') {
      render();
      return;
    }
    const mm = Number(value);
    if (!Number.isFinite(mm) || mm <= 0) return;
    params.T = mm;
    render();
  });

  root.querySelectorAll('[data-action="reset-view"]').forEach((button) => {
    button.addEventListener('click', () => {
      resetCameraView();
    });
  });

  root.querySelectorAll('[data-action="theme-toggle"]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleTheme();
    });
  });

  root.querySelector('[data-action="export-house"]')?.addEventListener('click', () => {
    exportBinaryAuthorized(
      exportFilename('house_stl'),
      'model/stl',
      'stl',
      () => export_house_stl(JSON.stringify(params)),
      tr('export_house_empty')
    );
  });

  root.querySelector('[data-action="export-door"]')?.addEventListener('click', () => {
    exportBinary(
      exportFilename('door_stl'),
      'model/stl',
      () => export_door_stl(JSON.stringify(params)),
      tr('export_door_empty')
    );
  });

  root.querySelector('[data-action="export-wall-mount"]')?.addEventListener('click', () => {
    exportBinary(
      exportFilename('wall_mount_stl'),
      'model/stl',
      () => export_wall_mount_stl(JSON.stringify(params)),
      tr('export_wall_mount_empty')
    );
  });

  root.querySelector('[data-action="export-panels"]')?.addEventListener('click', () => {
    exportBinary(
      exportFilename('panels_zip'),
      'application/zip',
      () => export_panels_zip(JSON.stringify(params)),
      tr('export_panels_empty')
    );
  });

  root.querySelector('[data-action="export-plan"]')?.addEventListener('click', () => {
    exportTextAuthorized(
      exportFilename('plan_svg'),
      'image/svg+xml',
      'svg',
      () => {
        const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
        return payload?.svg || '';
      },
      tr('export_plan_empty')
    );
  });

  root.querySelector('[data-action="download-plan-png"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('png', exportFilename('plan_png'), downloadPlanPng);
  });

  root.querySelector('[data-action="download-explosion-png"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('png', exportFilename('explosion_png'), downloadExplosionPng);
  });

  root.querySelector('[data-action="download-plan-pdf"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('pdf', exportFilename('plan_pdf'), downloadPlanPdf);
  });

  root.querySelector('[data-action="export-obj"]')?.addEventListener('click', () => {
    exportText(
      exportFilename('debug_obj'),
      'text/plain',
      () => export_house_obj(JSON.stringify(params)),
      tr('export_obj_empty')
    );
  });

  root.querySelector('[data-action="download-calcs-pdf"]')?.addEventListener('click', async () => {
    await downloadCalculationsPdf();
  });

  root.querySelector('[data-action="mesh-report"]')?.addEventListener('click', () => {
    try {
      const snapshot = saveMeshReportToBrowser();
      const payload = snapshot?.report;
      if (!payload) {
        setExportStatus(tr('mesh_report_invalid'), 'error');
        return;
      }
      const report = JSON.stringify(payload, null, 2);
      download(report, exportFilename('mesh_report_json'), 'application/json');
      const deg = payload.house?.degenerate_triangles ?? 0;
      const warnCount = payload.house?.warnings?.length ?? 0;
      const tone = deg || warnCount ? 'warn' : 'ok';
      setExportStatus(
        tr('mesh_report_created', {
          triangles: formatCountText(payload.house?.triangles ?? 0),
          degenerate: formatCountText(deg),
          bytes: formatCountText(payload.zip_bytes ?? 0),
        }),
        tone
      );
    } catch (err) {
      console.error(err);
      setExportStatus(tr('mesh_report_error', { error: err?.message || err }), 'error');
    }
  });

  bindTabs();
  updateDecoUploadUi();
  renderPlanPreview();
  renderViewer();
  saveMeshReportToBrowser();
  updateAccountDom();
  applyAdminVisibility();
  restoreUiState(uiState);
  if (uiState.modalOpen || modalWasOpen) openAccountModal();
}

window.addEventListener('pagehide', () => {
  saveMeshReportToBrowser();
  disposeViewerState();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) renderViewer();
});

try {
  await init({ module_or_path: new URL(`../wasm/pkg/wasm_bg.wasm?v=${APP_BUILD_ID}`, import.meta.url) });
  params = JSON.parse(default_params_json());
  debugStlLog('app booted', {
    appBuildId: APP_BUILD_ID,
    phpBase: PHP_BASE,
    wasmUrl: new URL(`../wasm/pkg/wasm_bg.wasm?v=${APP_BUILD_ID}`, import.meta.url).toString(),
    decorTargets: DECO_TARGET_KEYS,
  });
  params.lang = detectInitialLanguage();
  localStorage.setItem(LANG_KEY, params.lang);
  setDocumentLanguage();
  cameraState = initialCameraState();
  applyTheme();
  render();
  refreshAccountState({ silent: true });
  refreshAdminSession({ silent: true });
} catch (err) {
  console.error(err);
  sendClientLog('critical', 'wasm_load_failed', err?.message || 'WASM load failed', clientErrorContext(err));
  if (root) {
    root.textContent = tr('app_unavailable');
  }
}
