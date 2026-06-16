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
} from '../wasm/pkg/wasm.js?v=20260616-wall-mount-label-fit-v1';
import * as THREE from './vendor/three.module.min.js';

const APP_BUILD_ID = '20260616-wall-mount-label-fit-v1';
const root = document.getElementById('app');
const LANG_KEY = 'nichoir-lang';
const THEME_KEY = 'nichoir-theme';

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
  return window.location.origin;
}

const PHP_BASE = detectPhpBase();
const AUTH_TOKEN_KEY = 'nichoir-auth-token';
const MAX_DECO_FILE_BYTES = 2 * 1024 * 1024;
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
    decor_load_supported: 'Decor: charge un SVG, PNG, JPG, GIF ou WEBP.',
    decor_too_large: 'Decor: fichier trop lourd. Limite actuelle: 2 Mo.',
    decor_svg_heightmap: 'Decor: SVG rasterise en heightmap et envoye au WASM.',
    decor_image_heightmap: 'Decor: image heightmap envoyee au WASM.',
    decor_heightmap_failed: 'Decor: conversion heightmap impossible ({error}).',
    decor_read_failed: 'Decor: impossible de lire le fichier.',
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
    decor_load_supported: 'Decor: load an SVG, PNG, JPG, GIF, or WEBP.',
    decor_too_large: 'Decor: file too large. Current limit: 2 MB.',
    decor_svg_heightmap: 'Decor: SVG rasterized to a heightmap and sent to WASM.',
    decor_image_heightmap: 'Decor: heightmap image sent to WASM.',
    decor_heightmap_failed: 'Decor: heightmap conversion failed ({error}).',
    decor_read_failed: 'Decor: unable to read the file.',
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
let cleanupViewer = null;
let lastAccountFocus = null;
let accountState = {
  user: null,
  loading: false,
  error: '',
};
let accountTickets = [];
let accountTicketDetail = null;
let selectedAccountTicketId = null;
let clientLogTimestamps = [];
let modalWasOpen = false;
let theme = localStorage.getItem(THEME_KEY)
  || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

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
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  fetch(phpUrl('/api/client-log'), {
    method: 'POST',
    headers,
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

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(phpUrl(path), {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `api_${response.status}`);
  }
  return payload;
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
  if (localStorage.getItem(AUTH_TOKEN_KEY)) return tr('account_session_expired');
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
  if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
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
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    accountState = { user: null, loading: false, error: '' };
    updateAccountDom();
    return null;
  }

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
    localStorage.removeItem(AUTH_TOKEN_KEY);
    accountState = {
      user: null,
      loading: false,
      error: silent ? '' : tr('invalid_session', { error: err?.message || err }),
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
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    }
  } catch (err) {
    console.warn('logout failed', err);
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
  accountState = { user: null, loading: false, error: '' };
  updateAccountDom();
  setExportStatus(tr('account_logged_out'), 'info');
}

async function authorizeExport(exportType, filename) {
  if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
    throw new Error('connexion_requise');
  }
  setExportStatus(tr('authorizing_export', { filename }), 'info');
  return apiRequest('/api/exports/authorize', {
    method: 'POST',
    body: JSON.stringify({ export_type: exportType }),
  });
}

async function consumeExport(authorization) {
  if (!authorization) return null;
  const payload = await apiRequest('/api/exports/consume', {
    method: 'POST',
    body: JSON.stringify({ authorization }),
  });
  if (payload.user) {
    accountState = { user: payload.user, loading: false, error: '' };
    updateAccountDom();
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

async function exportBinaryAuthorized(filename, type, exportType, producer, emptyMessage) {
  let auth = null;
  try {
    auth = await authorizeExport(exportType, filename);
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
    const auth = await authorizeExport(exportType, filename);
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
    const auth = await authorizeExport(exportType, filename);
    const ok = await producer();
    if (ok) await consumeExport(auth.authorization);
  } catch (err) {
    console.error(err);
    setExportStatus(exportDeniedMessage(err), 'error');
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
  ['front', 'back', 'left', 'right', 'roofL', 'roofR'].forEach((key) => {
    if (!params.decos[key]) {
      params.decos[key] = {
        enabled: false,
        sourceType: '',
        sourceText: '',
        sourceData: '',
        mode: 'vector',
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
      };
    }
    if (params.decos[key].smooth === undefined) params.decos[key].smooth = 25;
    if (params.decos[key].threshold === undefined) params.decos[key].threshold = 2;
    if (params.decos[key].removeBg === undefined) params.decos[key].removeBg = false;
    if (params.decos[key].clipToPanel === undefined) params.decos[key].clipToPanel = true;
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

function normalizeDependentParams(changedKey) {
  if (changedKey === 'slope' && Math.abs(Number(params.slope) - 45) > 0.001) {
    params.ridge = 'miter';
  }
}

function refreshGeneratedViews() {
  renderPlanPreview();
  renderViewer();
}

async function refreshDecoRasterIfNeeded(deco) {
  if (!deco || deco.sourceType !== 'svg' || !deco.sourceText) return;
  const size = Math.max(64, Math.min(1024, Number(deco.resolution || 64) * 4));
  deco.sourceText = assertSafeSvgText(deco.sourceText);
  deco.sourceData = await rasterizeSvgToPngBase64(deco.sourceText, size);
}

function renderViewer() {
  const mount = document.getElementById('viewer');
  if (!mount) return;
  if (frameId) cancelAnimationFrame(frameId);
  if (cleanupViewer) cleanupViewer();
  cleanupViewer = null;

  const payload = parseResponse(scene_meshes_json(JSON.stringify(params)));
  if (!payload || !Array.isArray(payload.meshes)) return;

  const scene = new THREE.Scene();
  const css = getComputedStyle(document.body);
  const viewerBg = css.getPropertyValue('--viewer-bg').trim() || '#13151c';
  const edgeColor = css.getPropertyValue('--edge').trim() || '#2a1e15';
  scene.background = new THREE.Color(viewerBg);

  const rect = mount.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(260, Math.floor(rect.height));

  const camera = new THREE.PerspectiveCamera(42, width / height, 1, 5000);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    console.warn('viewer_unavailable', err);
    mount.innerHTML = '';
    const fallback = document.createElement('div');
    fallback.className = 'viewer-fallback';
    fallback.textContent = tr('viewer_unavailable');
    mount.appendChild(fallback);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  mount.textContent = '';
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.DirectionalLight(0xfff4df, 0.9);
  key.position.set(300, 420, 260);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcecff, 0.35);
  fill.position.set(-260, 180, -260);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];

  payload.meshes.forEach((m) => {
    if (!m.vertices || m.vertices.length < 9) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.vertices, 3));
    geo.computeVertexNormals();
    const edgesOnly = params.mode === 'edges';
    const isFacade = m.key === 'front' || m.key === 'back';
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

    if (isFacade && !edgesOnly) return;
    const edges = new THREE.EdgesGeometry(geo, 18);
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: edgesOnly ? 0xd4a574 : edgeColor,
      transparent: params.mode === 'xray',
      opacity: params.mode === 'xray' ? 0.62 : 1,
    }));
    group.add(lines);
    disposables.push(edges, lines.material);
  });

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  const updateCamera = () => {
    const phi = Math.max(0.18, Math.min(Math.PI - 0.18, cameraState.phi));
    const x = cameraState.dist * Math.sin(phi) * Math.sin(cameraState.theta);
    const y = cameraState.dist * Math.cos(phi);
    const z = cameraState.dist * Math.sin(phi) * Math.cos(cameraState.theta);
    camera.position.set(
      cameraState.target.x + x,
      cameraState.target.y + y,
      cameraState.target.z + z,
    );
    camera.lookAt(cameraState.target);
  };

  let dragging = false;
  let panMode = false;
  let lastX = 0;
  let lastY = 0;

  mount.addEventListener('pointerdown', (event) => {
    dragging = true;
    panMode = event.shiftKey || event.button === 1 || event.button === 2;
    lastX = event.clientX;
    lastY = event.clientY;
    mount.setPointerCapture(event.pointerId);
  });

  mount.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (panMode) {
      cameraState.target.x -= dx * 0.5;
      cameraState.target.y += dy * 0.5;
    } else {
      cameraState.theta -= dx * 0.008;
      cameraState.phi += dy * 0.008;
    }
    updateCamera();
  });

  mount.addEventListener('pointerup', (event) => {
    dragging = false;
    mount.releasePointerCapture(event.pointerId);
  });

  mount.addEventListener('contextmenu', (event) => event.preventDefault());
  mount.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraState.dist = Math.max(160, Math.min(1800, cameraState.dist + event.deltaY * 0.65));
    updateCamera();
  }, { passive: false });

  function animate() {
    updateCamera();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  cleanupViewer = () => {
    disposables.forEach((item) => item.dispose && item.dispose());
    renderer.dispose();
  };
  animate();
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
}

function render() {
  const uiState = captureUiState();
  setDocumentLanguage();
  ensureDecos();
  if (frameId) cancelAnimationFrame(frameId);
  if (cleanupViewer) cleanupViewer();
  cleanupViewer = null;
  root.innerHTML = render_app_html(JSON.stringify(params));
  applyTheme();

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
      deco[input.dataset.decoParam] = decoValueToParam(input);
      syncDecoControl(input.dataset.decoParam, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const deco = activeDeco();
      deco[input.dataset.decoParam] = decoValueToParam(input);
      syncDecoControl(input.dataset.decoParam, input.value);
      if (input.dataset.decoParam === 'resolution') {
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
      deco[input.dataset.decoNumber] = value;
      syncDecoControl(input.dataset.decoNumber, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const deco = activeDeco();
      deco[input.dataset.decoNumber] = value;
      syncDecoControl(input.dataset.decoNumber, input.value);
      if (input.dataset.decoNumber === 'resolution') {
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
      deco[input.dataset.decoBool] = input.checked;
      render();
    });
  });

  root.querySelector('[data-deco-file]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
    const isRaster = /image\/(png|jpeg|gif|webp)/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
    if (!isSvg && !isRaster) {
      setExportStatus(tr('decor_load_supported'), 'warn');
      return;
    }
    if (file.size > MAX_DECO_FILE_BYTES) {
      setExportStatus(tr('decor_too_large'), 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const deco = activeDeco();
      try {
        if (isSvg) {
          const svgText = assertSafeSvgText(reader.result || '');
          deco.sourceType = 'svg';
          deco.sourceText = svgText;
          deco.sourceData = await rasterizeSvgToPngBase64(svgText, Math.max(64, Math.min(512, Number(deco.resolution || 64) * 4)));
          deco.mode = 'heightmap';
          deco.enabled = true;
          deco.clipToPanel = true;
          setExportStatus(tr('decor_svg_heightmap'), 'ok');
        } else {
          const lower = file.name.toLowerCase();
          deco.sourceType = lower.endsWith('.webp') || file.type.includes('webp')
            ? 'webp'
            : lower.endsWith('.gif') || file.type.includes('gif')
              ? 'gif'
              : file.type.includes('jpeg') || /\.jpe?g$/i.test(lower)
                ? 'jpg'
                : 'png';
          deco.sourceText = '';
          deco.sourceData = bytesToBase64(new Uint8Array(reader.result));
          deco.mode = 'heightmap';
          deco.enabled = true;
          deco.clipToPanel = true;
          setExportStatus(tr('decor_image_heightmap'), 'ok');
        }
        render();
      } catch (err) {
        console.error(err);
        setExportStatus(tr('decor_heightmap_failed', { error: err?.message || err }), 'error');
      }
    };
    reader.onerror = () => setExportStatus(tr('decor_read_failed'), 'error');
    if (isSvg) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });

  root.querySelector('[data-deco-clear]')?.addEventListener('click', () => {
    const deco = activeDeco();
    deco.sourceType = '';
    deco.sourceText = '';
    deco.sourceData = '';
    deco.enabled = false;
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
    exportBinaryAuthorized(
      exportFilename('door_stl'),
      'model/stl',
      'stl',
      () => export_door_stl(JSON.stringify(params)),
      tr('export_door_empty')
    );
  });

  root.querySelector('[data-action="export-wall-mount"]')?.addEventListener('click', () => {
    exportBinaryAuthorized(
      exportFilename('wall_mount_stl'),
      'model/stl',
      'stl',
      () => export_wall_mount_stl(JSON.stringify(params)),
      tr('export_wall_mount_empty')
    );
  });

  root.querySelector('[data-action="export-panels"]')?.addEventListener('click', () => {
    exportBinaryAuthorized(
      exportFilename('panels_zip'),
      'application/zip',
      'zip',
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
    await runAuthorizedExport('pdf', exportFilename('calcs_pdf'), downloadCalculationsPdf);
  });

  root.querySelector('[data-action="mesh-report"]')?.addEventListener('click', () => {
    try {
      const payload = parseResponse(mesh_report_json(JSON.stringify(params)));
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
  renderPlanPreview();
  renderViewer();
  updateAccountDom();
  restoreUiState(uiState);
  if (uiState.modalOpen || modalWasOpen) openAccountModal();
}

try {
  await init({ module_or_path: new URL(`../wasm/pkg/wasm_bg.wasm?v=${APP_BUILD_ID}`, import.meta.url) });
  params = JSON.parse(default_params_json());
  params.lang = detectInitialLanguage();
  localStorage.setItem(LANG_KEY, params.lang);
  setDocumentLanguage();
  cameraState = initialCameraState();
  applyTheme();
  render();
  refreshAccountState({ silent: true });
} catch (err) {
  console.error(err);
  sendClientLog('critical', 'wasm_load_failed', err?.message || 'WASM load failed', clientErrorContext(err));
  if (root) {
    root.textContent = tr('app_unavailable');
  }
}
