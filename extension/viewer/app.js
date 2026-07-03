// Point d'entrée du viewer : ouverture des documents, câblage global.
import { STR } from './ui/strings-fr.js';
import {
  fetchBytes,
  openDocument,
  fileNameFromUrl,
  isAllowedUrl,
  LoadError,
} from './pdf-loader.js';
import { PageManager } from './page-manager.js';
import { initToolbar, bindPageManager } from './ui/toolbar.js';
import {
  banner,
  clearBanners,
  toast,
  askPassword,
  showLoading,
  hideLoading,
} from './ui/dialogs.js';

const $ = (id) => document.getElementById(id);

export const app = {
  /** @type {any} PDFDocumentProxy */
  pdfDocument: null,
  /** @type {Uint8Array|null} octets d'origine, intacts, pour l'export pdf-lib */
  originalBytes: null,
  fileName: STR.documentDefault,
  sourceUrl: null,
  /** @type {PageManager|null} */
  pageManager: null,
};

/**
 * Le paramètre `file` n'est PAS lu via URLSearchParams : la redirection DNR ne
 * peut pas encoder l'URL d'origine, qui peut donc contenir `?`, `&` et `#`.
 * On prend tout ce qui suit `file=` (plus le hash), brut.
 */
function parseFileParam() {
  const search = window.location.search;
  const idx = search.indexOf('file=');
  if (idx === -1) return null;
  let raw = search.slice(idx + 'file='.length) + window.location.hash;
  if (!raw) return null;
  // Nos propres liens (background, menus) encodent l'URL ; la redirection DNR non.
  if (/^(https?|file|blob)%3A/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* on garde la version brute */
    }
  }
  return raw;
}

function showEmptyState(visible) {
  $('emptyState').hidden = !visible;
  $('pages').hidden = visible;
}

async function openFromBytes(bytes, fileName, sourceUrl = null) {
  showLoading();
  clearBanners();
  try {
    const pdfDocument = await openDocument(bytes, { askPassword });

    // Remplacement de l'éventuel document précédent
    app.pageManager?.destroy();
    if (app.pdfDocument) await app.pdfDocument.destroy().catch(() => {});

    app.pdfDocument = pdfDocument;
    app.originalBytes = bytes;
    app.fileName = fileName;
    app.sourceUrl = sourceUrl;
    document.title = `${fileName} — ${STR.appName}`;

    showEmptyState(false);
    app.pageManager = new PageManager({
      container: $('viewerContainer'),
      pagesEl: $('pages'),
      pdfDocument,
    });
    await app.pageManager.init();
    bindPageManager(app.pageManager);
    document.dispatchEvent(new CustomEvent('app:documentopen'));

    if (pdfDocument.isPureXfa) banner('warn', STR.banners.xfa);
  } catch (err) {
    reportLoadError(err);
  } finally {
    hideLoading();
  }
}

async function openUrl(url) {
  showLoading();
  try {
    const bytes = await fetchBytes(url);
    await openFromBytes(bytes, fileNameFromUrl(url, STR.documentDefault), url);
  } catch (err) {
    hideLoading();
    reportLoadError(err);
  }
}

async function openFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  await openFromBytes(bytes, file.name || STR.documentDefault);
}

function reportLoadError(err) {
  console.error(err);
  const actions = [{ label: STR.banners.chooseFile, onClick: openPicker }];
  if (err instanceof LoadError) {
    const messages = {
      http: STR.errors.http(err.detail),
      network: STR.errors.network,
      'file-access': STR.errors.fileAccess,
      invalid: STR.errors.invalid,
      'password-canceled': STR.errors.passwordCanceled,
      'bad-scheme': STR.errors.badScheme,
    };
    banner('error', messages[err.code] ?? STR.errors.generic, actions);
  } else {
    banner('error', STR.errors.generic, actions);
  }
  if (!app.pdfDocument) showEmptyState(true);
}

function openPicker() {
  $('filePicker').click();
}

function wireFileInputs() {
  $('filePicker').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) openFile(file);
    e.target.value = '';
  });

  // Glisser-déposer sur toute la fenêtre
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    $('dropHint').hidden = false;
  });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      $('dropHint').hidden = true;
    }
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('dropHint').hidden = true;
    const file = [...(e.dataTransfer?.files ?? [])].find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (file) openFile(file);
  });
}

function wireShortcuts() {
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      openPicker();
    } else if (mod && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      app.pageManager?.zoomIn();
    } else if (mod && e.key === '-') {
      e.preventDefault();
      app.pageManager?.zoomOut();
    } else if (mod && e.key === '0') {
      e.preventDefault();
      app.pageManager?.setZoom(1);
    }
  });

  // Ctrl+molette : zoom
  $('viewerContainer').addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) app.pageManager?.zoomIn();
      else app.pageManager?.zoomOut();
    },
    { passive: false },
  );
}

function main() {
  initToolbar({ openPicker });
  wireFileInputs();
  wireShortcuts();

  const src = parseFileParam();
  if (src && isAllowedUrl(src)) {
    showEmptyState(false);
    openUrl(src);
  } else {
    if (src) banner('error', STR.errors.badScheme);
    showEmptyState(true);
  }
}

main();
