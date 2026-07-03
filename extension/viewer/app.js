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
import { initToolbar, bindPageManager, bindEditing } from './ui/toolbar.js';
import {
  banner,
  clearBanners,
  toast,
  askPassword,
  showLoading,
  hideLoading,
} from './ui/dialogs.js';
import { getSettings } from './ui/settings.js';
import { EditStore } from './edits/edit-store.js';
import { CommandStack } from './edits/commands.js';
import { Overlay } from './overlay/overlay.js';
import { ToolManager } from './tools/tool-manager.js';
import { SelectTool } from './tools/select-tool.js';
import { TextTool } from './tools/text-tool.js';
import { HighlightTool } from './tools/highlight-tool.js';
import { WhiteoutTool } from './tools/whiteout-tool.js';
import { FillDotsTool } from './tools/fill-dots-tool.js';
import { CheckTool } from './tools/check-tool.js';
import { renderAnnotationLayer, collectFormValues, hasFormChanges } from './forms/acroform.js';
import { exportPdf, download, suggestName } from './save/exporter.js';

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
  /** @type {EditStore|null} */
  store: null,
  /** @type {CommandStack|null} */
  stack: null,
  /** @type {Overlay|null} */
  overlay: null,
  /** @type {ToolManager|null} */
  toolManager: null,
  /** réglages chargés au démarrage, mutés en cours de session */
  settings: null,
};

function setupEditing() {
  app.store = new EditStore();
  app.stack = new CommandStack();
  app.overlay = new Overlay({
    store: app.store,
    stack: app.stack,
    pageManager: app.pageManager,
  });
  app.toolManager = new ToolManager({
    pagesEl: $('pages'),
    pageManager: app.pageManager,
    store: app.store,
    stack: app.stack,
    overlay: app.overlay,
    settings: app.settings,
  });
  const toolCtx = {
    store: app.store,
    stack: app.stack,
    overlay: app.overlay,
    settings: app.settings,
    pageManager: app.pageManager,
  };
  app.toolManager.register('select', new SelectTool(toolCtx));
  app.toolManager.register('text', new TextTool(toolCtx));
  app.toolManager.register('dots', new FillDotsTool(toolCtx));
  app.toolManager.register('check', new CheckTool(toolCtx));
  app.toolManager.register('highlight', new HighlightTool(toolCtx));
  app.toolManager.register('whiteout', new WhiteoutTool(toolCtx));
  app.toolManager.setTool('select');

  // Widgets AcroForm : rendus à chaque (re)rendu de page
  app.pageManager.addEventListener('pagerendered', (e) => {
    renderAnnotationLayer(e.detail, app.pdfDocument).catch((err) =>
      console.warn('Couche annotations :', err),
    );
  });
  for (const view of app.pageManager.views) {
    if (view.rendered) {
      renderAnnotationLayer(view, app.pdfDocument).catch((err) =>
        console.warn('Couche annotations :', err),
      );
    }
  }
  bindEditing({ toolManager: app.toolManager, stack: app.stack });

  const saveBtn = $('btnSave');
  saveBtn.disabled = false;
  saveBtn.onclick = saveDocument;
  const printBtn = $('btnPrint');
  printBtn.disabled = false;
  printBtn.onclick = printDocument;
}

let printFrame = null;

/**
 * Imprime le PDF ÉDITÉ : export pdf-lib → blob dans un iframe caché →
 * impression par le lecteur PDF natif (pleine qualité vectorielle).
 * La règle DNR ne touche pas les sous-frames blob:.
 */
async function printDocument() {
  if (!app.pdfDocument || !app.originalBytes) return;
  document.querySelector('.edit-box.editing')?.blur();
  document.activeElement?.blur?.();
  showLoading(STR.saving);
  try {
    const { bytes } = await exportPdf({
      originalBytes: app.originalBytes,
      edits: app.store.all(),
      formValues: await collectFormValues(app.pdfDocument),
    });
    if (printFrame) {
      URL.revokeObjectURL(printFrame.src);
      printFrame.remove();
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    printFrame = document.createElement('iframe');
    printFrame.id = 'printFrame';
    Object.assign(printFrame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '2px',
      height: '2px',
      opacity: '0',
      border: '0',
    });
    printFrame.src = url;
    printFrame.addEventListener('load', () => {
      hideLoading();
      // petit délai : le lecteur PDF du sous-frame finit de s'initialiser
      setTimeout(() => {
        try {
          printFrame.contentWindow.print();
        } catch (err) {
          console.warn('Impression :', err);
        }
      }, 400);
    });
    document.body.append(printFrame);
    // filet si load ne vient jamais (lecteur PDF indisponible)
    setTimeout(hideLoading, 4000);
  } catch (err) {
    console.error(err);
    hideLoading();
    banner('error', STR.errors.saveFailed);
  }
}

async function saveDocument() {
  if (!app.pdfDocument || !app.originalBytes) return;
  // Valide une éventuelle saisie en cours pour l'inclure dans l'export
  document.querySelector('.edit-box.editing')?.blur();
  document.activeElement?.blur?.(); // widgets AcroForm : valeur committée au blur
  showLoading(STR.saving);
  try {
    const { bytes, warnings } = await exportPdf({
      originalBytes: app.originalBytes,
      edits: app.store.all(),
      formValues: await collectFormValues(app.pdfDocument),
    });
    download(bytes, suggestName(app.fileName));
    app.stack.markSaved();
    toast(STR.toasts.saved);
    if (warnings.has('charReplaced')) toast(STR.toasts.charReplaced);
  } catch (err) {
    console.error(err);
    banner('error', STR.errors.saveFailed);
  } finally {
    hideLoading();
  }
}

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
    setupEditing();
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

const TOOL_KEYS = { v: 'select', t: 'text', p: 'dots', c: 'check', s: 'highlight', b: 'whiteout' };

function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]'));
}

function wireShortcuts() {
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Ctrl+S / Ctrl+P fonctionnent même pendant une saisie (validée d'abord)
    if (mod && key === 's') {
      e.preventDefault();
      saveDocument();
      return;
    }
    if (mod && key === 'p') {
      e.preventDefault();
      printDocument();
      return;
    }
    // Pendant une saisie : laisser l'édition native (y compris son Ctrl+Z)
    if (isTypingTarget(e.target)) return;

    if (mod && key === 'o') {
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
    } else if (mod && key === 'z' && e.shiftKey) {
      e.preventDefault();
      app.stack?.redo();
    } else if (mod && key === 'z') {
      e.preventDefault();
      app.stack?.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      app.stack?.redo();
    } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (app.overlay?.selected) {
        e.preventDefault();
        app.overlay.deleteSelected();
      }
    } else if (e.key === 'Escape') {
      app.overlay?.deselect();
      app.toolManager?.setTool('select');
    } else if (!mod && !e.altKey && TOOL_KEYS[key] && app.toolManager) {
      app.toolManager.setTool(TOOL_KEYS[key]);
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

async function main() {
  app.settings = await getSettings();
  initToolbar({ openPicker });
  wireFileInputs();
  wireShortcuts();

  window.addEventListener('beforeunload', (e) => {
    if (app.stack?.dirty || hasFormChanges(app.pdfDocument)) {
      e.preventDefault();
      e.returnValue = STR.confirmLeave;
    }
  });

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
