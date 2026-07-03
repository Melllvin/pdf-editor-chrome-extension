// Câblage de la barre d'outils (navigation, zoom, ouverture, outils, annulation).
import { STR } from './strings-fr.js';

const $ = (id) => document.getElementById(id);

/**
 * Initialise les boutons indépendants du document.
 * @param {{ openPicker: () => void }} handlers
 */
export function initToolbar({ openPicker }) {
  $('btnOpen').addEventListener('click', openPicker);
  $('btnEmptyOpen').addEventListener('click', openPicker);
}

const TOOL_SHORTCUTS = { select: 'V', text: 'T', dots: 'P', check: 'C', highlight: 'S', whiteout: 'B' };

/**
 * (Re)construit les boutons d'outils et branche annuler/rétablir sur le
 * document courant.
 * @param {{ toolManager: any, stack: any }} ctx
 */
export function bindEditing({ toolManager, stack }) {
  const group = $('toolGroup');
  group.replaceChildren();
  for (const name of toolManager.tools.keys()) {
    const btn = document.createElement('button');
    btn.className = 'tb-btn tb-tool';
    btn.dataset.tool = name;
    btn.textContent = STR.tools[name] ?? name;
    btn.title = `${STR.tools[name]} (${TOOL_SHORTCUTS[name] ?? ''})`;
    btn.addEventListener('click', () => toolManager.setTool(name));
    group.append(btn);
  }
  group.hidden = false;

  const reflectTool = (name) => {
    for (const b of group.querySelectorAll('.tb-tool')) {
      b.classList.toggle('active', b.dataset.tool === name);
    }
  };
  toolManager.addEventListener('toolchange', (e) => reflectTool(e.detail));
  reflectTool(toolManager.activeName);

  const undoBtn = $('btnUndo');
  const redoBtn = $('btnRedo');
  undoBtn.onclick = () => stack.undo();
  redoBtn.onclick = () => stack.redo();
  const reflectStack = () => {
    undoBtn.disabled = !stack.canUndo;
    redoBtn.disabled = !stack.canRedo;
  };
  stack.addEventListener('change', reflectStack);
  reflectStack();
}

/**
 * (Re)branche la barre sur un PageManager fraîchement créé.
 * Les écouteurs précédents meurent avec l'ancien manager.
 * @param {import('../page-manager.js').PageManager} pm
 */
export function bindPageManager(pm) {
  const pageInput = $('pageInput');
  const zoomLabel = $('zoomLabel');

  pageInput.disabled = false;
  pageInput.max = String(pm.pageCount);
  pageInput.value = String(pm.currentPageIndex + 1);
  $('pageCount').textContent = String(pm.pageCount);

  const updateZoomLabel = () => {
    zoomLabel.textContent = `${Math.round(pm.zoom * 100)} %`;
  };
  updateZoomLabel();

  pm.addEventListener('pagechange', (e) => {
    pageInput.value = String(e.detail + 1);
  });
  pm.addEventListener('scalechange', updateZoomLabel);

  $('btnPrev').onclick = () => pm.goToPage(pm.currentPageIndex - 1);
  $('btnNext').onclick = () => pm.goToPage(pm.currentPageIndex + 1);
  pageInput.onchange = () => {
    const n = Number.parseInt(pageInput.value, 10);
    if (Number.isFinite(n)) pm.goToPage(n - 1);
  };
  $('btnZoomIn').onclick = () => pm.zoomIn();
  $('btnZoomOut').onclick = () => pm.zoomOut();
  $('zoomLabel').onclick = () => pm.setZoom(1);
  $('btnFitWidth').onclick = () => pm.fitWidth();
}
