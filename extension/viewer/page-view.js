// Rendu d'une page : canvas HiDPI + couche texte + conteneurs des couches d'édition.
import { pdfjsLib } from './pdf-loader.js';

export class PageView {
  /**
   * @param {{
   *   pdfDocument: any,
   *   pageIndex: number,
   *   getScale: () => number,
   *   onRendered?: (view: PageView) => void,
   * }} opts
   */
  constructor({ pdfDocument, pageIndex, getScale, onRendered }) {
    this.pdfDocument = pdfDocument;
    this.pageIndex = pageIndex;
    this.getScale = getScale;
    this.onRendered = onRendered;

    this.page = null; // PDFPageProxy, chargé au premier montage
    this.viewport = null;
    this.textContent = null;
    this.textLayer = null;
    this.renderTask = null;
    this.rendered = false;
    this._renderSeq = 0;

    const el = document.createElement('div');
    el.className = 'page';
    el.dataset.pageIndex = String(pageIndex);

    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'canvasWrapper';
    this.canvas = document.createElement('canvas');
    this.canvasWrapper.append(this.canvas);

    this.highlightLayerEl = document.createElement('div');
    this.highlightLayerEl.className = 'highlightLayer';
    this.textLayerEl = document.createElement('div');
    this.textLayerEl.className = 'textLayer';
    this.annotationLayerEl = document.createElement('div');
    this.annotationLayerEl.className = 'annotationLayer';
    this.dotZonesEl = document.createElement('div');
    this.dotZonesEl.className = 'dotZones';
    this.editLayerEl = document.createElement('div');
    this.editLayerEl.className = 'editLayer';

    el.append(
      this.canvasWrapper,
      this.highlightLayerEl,
      this.textLayerEl,
      this.annotationLayerEl,
      this.dotZonesEl,
      this.editLayerEl,
    );
    this.el = el;
  }

  /** Dimensionne la page (placeholder ou réel) pour l'échelle CSS donnée. */
  setCssSize(baseViewport) {
    const scale = this.getScale();
    const w = baseViewport.width * scale;
    const h = baseViewport.height * scale;
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.el.style.setProperty('--scale-factor', String(scale));
  }

  /** Viewport à l'échelle 1 (dimensions de base). */
  get baseViewport() {
    return this._baseViewport;
  }

  set baseViewport(vp) {
    this._baseViewport = vp;
    this.setCssSize(vp);
  }

  async ensurePage() {
    if (!this.page) {
      this.page = await this.pdfDocument.getPage(this.pageIndex + 1);
      this.baseViewport = this.page.getViewport({ scale: 1 });
    }
    return this.page;
  }

  /** Rend (ou re-rend) la page à l'échelle courante. */
  async render() {
    const seq = ++this._renderSeq;
    await this.ensurePage();
    if (seq !== this._renderSeq) return; // un rendu plus récent a pris la main

    this.cancelRender();
    const scale = this.getScale();
    const viewport = this.page.getViewport({ scale });
    this.viewport = viewport;
    this.setCssSize(this.baseViewport);

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(viewport.width * dpr);
    this.canvas.height = Math.floor(viewport.height * dpr);
    this.canvas.style.width = `${viewport.width}px`;
    this.canvas.style.height = `${viewport.height}px`;

    const ctx = this.canvas.getContext('2d');
    this.renderTask = this.page.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
    });

    try {
      await this.renderTask.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }
    if (seq !== this._renderSeq) return;

    await this.renderTextLayer(viewport, seq);
    if (seq !== this._renderSeq) return;

    this.rendered = true;
    this.renderedScale = scale;
    this.onRendered?.(this);
  }

  async renderTextLayer(viewport, seq) {
    this.textLayer?.cancel();
    this.textLayerEl.replaceChildren();
    this.textContent = await this.page.getTextContent();
    if (seq !== this._renderSeq) return;
    this.textLayer = new pdfjsLib.TextLayer({
      textContentSource: this.textContent,
      container: this.textLayerEl,
      viewport,
    });
    await this.textLayer.render();
  }

  cancelRender() {
    this.renderTask?.cancel();
    this.renderTask = null;
  }

  /** Libère les ressources de rendu (la page reste dimensionnée en placeholder). */
  unmount() {
    this._renderSeq++;
    this.cancelRender();
    this.textLayer?.cancel();
    this.textLayer = null;
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.style.width = '';
    this.canvas.style.height = '';
    this.textLayerEl.replaceChildren();
    this.annotationLayerEl.replaceChildren();
    this.dotZonesEl.replaceChildren();
    this.editLayerEl.replaceChildren();
    this.highlightLayerEl.replaceChildren();
    this.rendered = false;
  }

  destroy() {
    this.unmount();
    this.el.remove();
  }
}
