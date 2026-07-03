// Câblage de la barre d'outils (navigation, zoom, ouverture).
// Les boutons d'outils et d'actions sont branchés par les jalons suivants.

const $ = (id) => document.getElementById(id);

/**
 * Initialise les boutons indépendants du document.
 * @param {{ openPicker: () => void }} handlers
 */
export function initToolbar({ openPicker }) {
  $('btnOpen').addEventListener('click', openPicker);
  $('btnEmptyOpen').addEventListener('click', openPicker);
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
