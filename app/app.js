import init, {
  default_params_json,
  render_app_html,
  scene_meshes_json,
  export_house_stl,
  export_house_obj,
  export_door_stl,
  export_panels_zip,
  mesh_report_json,
  plan_preview_svg,
} from '../wasm/pkg/wasm.js?v=20260612-app-cleanup-v1';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

const APP_BUILD_ID = '20260612-app-cleanup-v1';
const root = document.getElementById('app');
const THEME_KEY = 'nichoir-theme';
const DEV_PHP_ORIGIN = 'http://127.0.0.1:8021';
const IS_LOCAL_DEV = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
const PHP_BASE = window.NICHOIR_PHP_BASE
  || (window.location.port === '8016' ? DEV_PHP_ORIGIN : window.location.origin);
const AUTH_TOKEN_KEY = 'nichoir-auth-token';
const MAX_DECO_FILE_BYTES = 2 * 1024 * 1024;
const DEMO_ACCOUNT = window.NICHOIR_DEMO_ACCOUNT
  || (IS_LOCAL_DEV ? { email: 'demo@nichoir.local', password: 'password123' } : null);
const EXPORT_COSTS = {
  svg: 1,
  png: 1,
  pdf: 2,
  stl: 3,
  zip: 5,
};
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
let theme = localStorage.getItem(THEME_KEY)
  || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme() {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-action="theme-toggle"]').forEach((button) => {
    button.textContent = isDark ? 'Sombre' : 'Clair';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Passer au mode clair' : 'Passer au mode sombre');
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
  return new URL(path, PHP_BASE).toString();
}

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
    buttons.after(status);
  }
  if (!status) return;
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

function accountStatusLabel() {
  if (accountState.loading) return 'Chargement...';
  if (accountState.user) return 'Connecte';
  if (localStorage.getItem(AUTH_TOKEN_KEY)) return 'Session expiree';
  return 'Non connecte';
}

function updateAccountDom() {
  const user = accountState.user;
  setAccountText('[data-account-balance]', user ? String(user.credits ?? 0) : '0');
  setAccountText('[data-account-state]', accountStatusLabel());
  setAccountText('[data-account-email-label]', user?.email || '-');
  setAccountText('[data-account-plan]', user?.subscription_status || 'none');
  setAccountText('[data-account-error]', accountState.error || '');
  root.querySelectorAll('[data-account-authed]').forEach((el) => {
    el.hidden = !user;
  });
  root.querySelectorAll('[data-account-guest]').forEach((el) => {
    el.hidden = Boolean(user);
  });
  root.querySelectorAll('[data-demo-account]').forEach((el) => {
    el.hidden = !DEMO_ACCOUNT || Boolean(user);
  });
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
    return accountState.user;
  } catch (err) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    accountState = {
      user: null,
      loading: false,
      error: silent ? '' : `Session invalide: ${err?.message || err}`,
    };
    updateAccountDom();
    return null;
  }
}

async function loginAccount() {
  if (!DEMO_ACCOUNT) {
    accountState = {
      user: null,
      loading: false,
      error: 'Connexion demo desactivee hors environnement local.',
    };
    updateAccountDom();
    return;
  }
  accountState = { user: accountState.user, loading: true, error: '' };
  updateAccountDom();
  try {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(DEMO_ACCOUNT),
    });
    if (payload.token) localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    accountState = { user: payload.user || null, loading: false, error: '' };
    updateAccountDom();
    setExportStatus('Compte demo connecte.', 'ok');
  } catch (err) {
    accountState = { user: null, loading: false, error: err?.message || String(err) };
    updateAccountDom();
    setExportStatus(`Compte: ${err?.message || err}`, 'error');
  }
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
  setExportStatus('Compte deconnecte.', 'info');
}

async function authorizeExport(exportType, filename) {
  if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
    throw new Error('connexion_requise');
  }
  setExportStatus(`Autorisation serveur pour ${filename}...`, 'info');
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
    return 'Connexion requise avant ce telechargement. Ouvre Compte et connecte le demo.';
  }
  if (code === 'insufficient_credits') {
    return 'Credits insuffisants pour ce telechargement.';
  }
  return `Autorisation refusee: ${code}`;
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
    const suffix = Number.isFinite(credits) ? ` Credits restants: ${credits}.` : '';
    setExportStatus(`Fichier cree: ${filename} (${bytes.byteLength.toLocaleString('fr-CA')} octets). Cout: ${auth.cost ?? EXPORT_COSTS[exportType] ?? '?'} credits.${suffix}`, 'ok');
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
    const suffix = Number.isFinite(credits) ? ` Credits restants: ${credits}.` : '';
    setExportStatus(`Fichier cree: ${filename} (${String(text).length.toLocaleString('fr-CA')} caracteres). Cout: ${auth.cost ?? EXPORT_COSTS[exportType] ?? '?'} credits.${suffix}`, 'ok');
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
    setExportStatus(`Fichier cree: ${filename} (${bytes.byteLength.toLocaleString('fr-CA')} octets)`, 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur export: ${err?.message || err}`, 'error');
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
    'NICHOIR - Calculs',
    `Genere le ${new Date().toLocaleString('fr-CA')}`,
    '',
    'CALCULS',
  ];
  panel?.querySelectorAll('.stat-row').forEach((row) => {
    const label = row.querySelector('span')?.textContent || '';
    const value = row.querySelector('strong')?.textContent || '';
    lines.push(`${label}: ${value}`);
  });
  lines.push('', 'PIECES');
  panel?.querySelectorAll('.cut-row').forEach((row) => {
    const name = row.querySelector('span')?.textContent || '';
    const qty = row.querySelector('strong')?.textContent || '';
    const dims = row.querySelector('small')?.textContent || '';
    const note = row.querySelector('em')?.textContent || '';
    lines.push(`${name} | qte ${qty} | ${dims}${note ? ` | ${note}` : ''}`);
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
    download(pdf, 'nichoir_calculs.pdf', 'application/pdf');
    setExportStatus('Fichier cree: nichoir_calculs.pdf', 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur PDF calcul: ${err?.message || err}`, 'error');
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
      reject(new Error('Impossible de convertir le plan SVG en image PDF'));
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
  const generatedAt = new Date().toLocaleString('fr-CA');
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
    if (/pente|angle|retrait|coupe|biseau|lame|trait/i.test(label)) {
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
      `NICHOIR - Piece ${index + 1}: ${name}`,
      `Genere le ${generatedAt}`,
      '',
      'IDENTIFICATION',
      `Nom: ${name}`,
      `Quantite: ${qty}`,
      `Dimensions: ${dims}`,
      `Coupes / angles de cette piece: ${note || 'coupe droite / aucun angle special'}`,
      '',
      'ANGLES ET COUPES DU MODELE',
      ...angleLines,
      '',
      'PARAMETRES DU PLAN DE COUPE',
      ...planStats,
      '',
      'NOTE FABRICATION',
      'Verifier le sens de pose, les chants biseautes et la crete avant coupe finale.',
    ];
    pages.push(page.flatMap((line) => wrapPdfLine(line)));
  });
  if (!pages.length) {
    pages.push([
      'NICHOIR - Plan de coupe',
      `Genere le ${generatedAt}`,
      '',
      'Aucune piece trouvee dans la table de calcul.',
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
    if (normalized === 'facade' && qty >= 2) names = ['Façade avant', 'Façade arrière'];
    else if (normalized === 'cote' && qty >= 2) names = ['Côté gauche', 'Côté droit'];
    else if (normalized === 'toit' && qty >= 2) names = ['Toit gauche', 'Toit droit'];
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
    .filter((item) => /pente|angle|retrait|coupe|biseau|lame|trait/i.test(item.label))
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
  ctx.fillText(`Piece ${piece.index + 1}: ${cleanPdfText(piece.name)}`, 70, 105);
  ctx.font = '24px monospace';
  ctx.fillStyle = '#6d6255';
  ctx.fillText(`Quantite: ${cleanPdfText(piece.qty)}`, 70, 150);
  ctx.fillText(`Dimensions: ${cleanPdfText(piece.dims)}`, 70, 190);

  const shapeX = 90;
  const shapeY = 280;
  const shapeW = 760;
  const shapeH = 500;
  const normalizedName = cleanPdfText(piece.name).toLowerCase();
  ctx.fillStyle = '#d4a574';
  ctx.strokeStyle = '#7b4308';
  ctx.lineWidth = 4;
  if (/facade/.test(normalizedName)) {
    ctx.beginPath();
    ctx.moveTo(shapeX, shapeY + shapeH);
    ctx.lineTo(shapeX + shapeW, shapeY + shapeH);
    ctx.lineTo(shapeX + shapeW, shapeY + shapeH * 0.35);
    ctx.lineTo(shapeX + shapeW / 2, shapeY);
    ctx.lineTo(shapeX, shapeY + shapeH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (/avant/.test(normalizedName) && params.door !== 'none') {
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
  } else if (/perchoir/.test(normalizedName)) {
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
  ctx.fillText('Schema indicatif de la piece. Voir dimensions exactes et coupes a droite.', shapeX, shapeY + shapeH + 112);

  const textX = 960;
  const textWidth = 620;
  let y = 280;
  ctx.fillStyle = '#24211d';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('Coupes et angles', textX, y);
  y += 42;
  ctx.font = '23px monospace';
  y = drawWrappedCanvasText(ctx, piece.note || 'coupe droite / aucun angle special', textX, y, textWidth, 32);
  y += 24;
  ctx.font = 'bold 24px monospace';
  ctx.fillText('Angles du modele', textX, y);
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
  if (!payload?.meshes?.length) throw new Error('aucun mesh pour image eclatee');

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
      setExportStatus('PDF plan impossible: aucun plan SVG genere.', 'warn');
      return false;
    }
    const planImage = await renderSvgToJpeg(payload.svg);
    const angleLines = collectAngleLines();
    const pieceImages = collectPlanPieces().map((piece) => ({
      title: `Piece ${piece.index + 1}: ${piece.name}`,
      image: renderPieceCard(piece, angleLines, 'image/jpeg'),
    }));
    const explosionImage = renderExplosionImage('image/jpeg');
    const pdf = buildPlanPdf([], [
      ...pieceImages,
      { title: 'Assemblage eclate', image: explosionImage },
      { title: 'Plan de coupe', image: planImage },
    ]);
    download(pdf, 'nichoir_plan_de_coupe.pdf', 'application/pdf');
    setExportStatus('Fichier cree: nichoir_plan_de_coupe.pdf', 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur PDF plan: ${err?.message || err}`, 'error');
    return false;
  }
}

async function downloadPlanPng() {
  try {
    const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
    if (!payload?.svg) {
      setExportStatus('PNG plan impossible: aucun plan SVG genere.', 'warn');
      return false;
    }
    const image = await renderSvgToPng(payload.svg);
    download(image.bytes, 'nichoir_plan_de_coupe.png', 'image/png');
    setExportStatus('Fichier cree: nichoir_plan_de_coupe.png', 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur PNG plan: ${err?.message || err}`, 'error');
    return false;
  }
}

function downloadExplosionPng() {
  try {
    const image = renderExplosionImage('image/png');
    download(image.bytes, 'nichoir_assemblage_eclate.png', 'image/png');
    setExportStatus('Fichier cree: nichoir_assemblage_eclate.png', 'ok');
    return true;
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur PNG explosion: ${err?.message || err}`, 'error');
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
    setExportStatus(`Fichier cree: ${filename} (${String(text).length.toLocaleString('fr-CA')} caracteres)`, 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur export: ${err?.message || err}`, 'error');
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

  const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    if (lastAccountFocus && document.contains(lastAccountFocus)) lastAccountFocus.focus();
  };
  const openAccountModal = () => {
    if (!accountModal) return;
    lastAccountFocus = document.activeElement;
    accountModal.hidden = false;
    accountModal.classList.add('is-open');
    refreshAccountState({ silent: true });
    accountModal.querySelector('[data-account-modal-close]')?.focus();
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
  [
    ['token-pricing', 'Credits: STL 3, PDF 2, ZIP 5, SVG/PNG 1. Le site PHP reste la source de verite.'],
  ].forEach(([action, message]) => {
    root.querySelector(`[data-action="${action}"]`)?.addEventListener('click', () => {
      setExportStatus(message, 'info');
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
      setExportStatus('Decor: charge un SVG, PNG, JPG, GIF ou WEBP.', 'warn');
      return;
    }
    if (file.size > MAX_DECO_FILE_BYTES) {
      setExportStatus('Decor: fichier trop lourd. Limite actuelle: 2 Mo.', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const deco = activeDeco();
      try {
        if (isSvg) {
          const svgText = String(reader.result || '');
          deco.sourceType = 'svg';
          deco.sourceText = svgText;
          deco.sourceData = await rasterizeSvgToPngBase64(svgText, Math.max(64, Math.min(512, Number(deco.resolution || 64) * 4)));
          deco.mode = 'heightmap';
          deco.enabled = true;
          deco.clipToPanel = true;
          setExportStatus('Decor: SVG rasterise en heightmap et envoye au WASM.', 'ok');
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
          setExportStatus('Decor: image heightmap envoyee au WASM.', 'ok');
        }
        render();
      } catch (err) {
        console.error(err);
        setExportStatus(`Decor: conversion heightmap impossible (${err?.message || err}).`, 'error');
      }
    };
    reader.onerror = () => setExportStatus('Decor: impossible de lire le fichier.', 'error');
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
      'nichoir_maison.stl',
      'model/stl',
      'stl',
      () => export_house_stl(JSON.stringify(params)),
      'Export maison vide: le modele n a genere aucun triangle.'
    );
  });

  root.querySelector('[data-action="export-door"]')?.addEventListener('click', () => {
    exportBinaryAuthorized(
      'nichoir_porte.stl',
      'model/stl',
      'stl',
      () => export_door_stl(JSON.stringify(params)),
      'Pas de porte STL: choisis une porte et active "Creer le panneau de porte".'
    );
  });

  root.querySelector('[data-action="export-panels"]')?.addEventListener('click', () => {
    exportBinaryAuthorized(
      'nichoir_panneaux.zip',
      'application/zip',
      'zip',
      () => export_panels_zip(JSON.stringify(params)),
      'Export panneaux vide: aucune piece n a ete generee.'
    );
  });

  root.querySelector('[data-action="export-plan"]')?.addEventListener('click', () => {
    exportTextAuthorized(
      'nichoir_plan.svg',
      'image/svg+xml',
      'svg',
      () => {
        const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
        return payload?.svg || '';
      },
      'Export plan impossible: aucun SVG genere.'
    );
  });

  root.querySelector('[data-action="download-plan-png"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('png', 'nichoir_plan_de_coupe.png', downloadPlanPng);
  });

  root.querySelector('[data-action="download-explosion-png"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('png', 'nichoir_assemblage_eclate.png', downloadExplosionPng);
  });

  root.querySelector('[data-action="download-plan-pdf"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('pdf', 'nichoir_plan_de_coupe.pdf', downloadPlanPdf);
  });

  root.querySelector('[data-action="export-obj"]')?.addEventListener('click', () => {
    exportText(
      'nichoir_maison_debug.obj',
      'text/plain',
      () => export_house_obj(JSON.stringify(params)),
      'Export OBJ vide: le modele n a genere aucun triangle.'
    );
  });

  root.querySelector('[data-action="download-calcs-pdf"]')?.addEventListener('click', async () => {
    await runAuthorizedExport('pdf', 'nichoir_calculs.pdf', downloadCalculationsPdf);
  });

  root.querySelector('[data-action="mesh-report"]')?.addEventListener('click', () => {
    try {
      const payload = parseResponse(mesh_report_json(JSON.stringify(params)));
      if (!payload) {
        setExportStatus('Rapport mesh impossible: reponse WASM invalide.', 'error');
        return;
      }
      const report = JSON.stringify(payload, null, 2);
      download(report, 'nichoir_mesh_report.json', 'application/json');
      const deg = payload.house?.degenerate_triangles ?? 0;
      const warnCount = payload.house?.warnings?.length ?? 0;
      const tone = deg || warnCount ? 'warn' : 'ok';
      setExportStatus(
        `Rapport cree: maison ${payload.house?.triangles ?? 0} triangles, ${deg} degeneres, ZIP ${(payload.zip_bytes ?? 0).toLocaleString('fr-CA')} octets`,
        tone
      );
    } catch (err) {
      console.error(err);
      setExportStatus(`Erreur rapport mesh: ${err?.message || err}`, 'error');
    }
  });

  bindTabs();
  renderPlanPreview();
  renderViewer();
  updateAccountDom();
  restoreUiState(uiState);
}

await init(new URL(`../wasm/pkg/wasm_bg.wasm?v=${APP_BUILD_ID}`, import.meta.url));
params = JSON.parse(default_params_json());
cameraState = initialCameraState();
applyTheme();
render();
refreshAccountState({ silent: true });
