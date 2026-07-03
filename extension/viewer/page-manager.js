// Gère l'ensemble des pages : montage paresseux, zoom, navigation, page courante.
import { PageView } from './page-view.js';

const CSS_UNITS = 96 / 72; // à zoom « 100 % », 1 pt PDF = 1/72 po = 96/72 px CSS
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const PAGE_GUTTER = 48; // marges latérales pour « ajuster à la largeur »

export class PageManager extends EventTarget {
  /**
   * @param {{container: HTMLElement, pagesEl: HTMLElement, pdfDocument: any}} opts
   */
  constructor({ container, pagesEl, pdfDocument }) {
    super();
    this.container = container;
    this.pagesEl = pagesEl;
    this.pdfDocument = pdfDocument;
    /** @type {PageView[]} */
    this.views = [];
    this.zoom = 1;
    this.fitMode = 'width'; // 'width' | 'custom'
    this.currentPageIndex = 0;
    this._ratios = new Map();
    this._mounted = new Set();
  }

  get cssScale() {
    return this.zoom * CSS_UNITS;
  }

  get pageCount() {
    return this.pdfDocument.numPages;
  }

  async init() {
    const firstPage = await this.pdfDocument.getPage(1);
    const defaultBase = firstPage.getViewport({ scale: 1 });
    const getScale = () => this.cssScale;
    const onRendered = (view) =>
      this.dispatchEvent(new CustomEvent('pagerendered', { detail: view }));

    for (let i = 0; i < this.pageCount; i++) {
      const view = new PageView({ pdfDocument: this.pdfDocument, pageIndex: i, getScale, onRendered });
      if (i === 0) {
        view.page = firstPage;
        view.baseViewport = defaultBase;
      } else {
        view.baseViewport = defaultBase; // placeholder, ajusté au montage réel
      }
      this.views.push(view);
    }
    this.defaultBase = defaultBase;
    this.fitWidth();
    this.pagesEl.append(...this.views.map((v) => v.el));

    this._mountObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const view = this.views[Number(entry.target.dataset.pageIndex)];
          if (entry.isIntersecting) {
            this._mounted.add(view);
            this._ensureRendered(view);
          } else if (this._mounted.has(view)) {
            this._mounted.delete(view);
            view.unmount();
          }
        }
      },
      { root: this.container, rootMargin: '1200px 0px' },
    );

    this._pageObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this._ratios.set(Number(entry.target.dataset.pageIndex), entry.intersectionRatio);
        }
        let best = this.currentPageIndex;
        let bestRatio = -1;
        for (const [idx, ratio] of this._ratios) {
          if (ratio > bestRatio || (ratio === bestRatio && idx < best)) {
            best = idx;
            bestRatio = ratio;
          }
        }
        if (best !== this.currentPageIndex) {
          this.currentPageIndex = best;
          this.dispatchEvent(new CustomEvent('pagechange', { detail: best }));
        }
      },
      { root: this.container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const view of this.views) {
      this._mountObserver.observe(view.el);
      this._pageObserver.observe(view.el);
    }

    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (this.fitMode === 'width') this.fitWidth();
      }, 150);
    };
    window.addEventListener('resize', this._onResize);
  }

  _ensureRendered(view) {
    if (view.rendered && view.renderedScale === this.cssScale) return;
    view.render().catch((err) => console.error(`Rendu de la page ${view.pageIndex + 1} :`, err));
  }

  /** @param {number} zoom facteur (1 = 100 %) */
  setZoom(zoom, { fitMode = 'custom' } = {}) {
    zoom = Math.min(ZOOM_STEPS.at(-1), Math.max(ZOOM_STEPS[0], zoom));
    this.fitMode = fitMode;
    if (Math.abs(zoom - this.zoom) < 0.001) return;

    const { container } = this;
    const anchorRatio =
      container.scrollHeight > 0
        ? (container.scrollTop + container.clientHeight / 2) / container.scrollHeight
        : 0;

    this.zoom = zoom;
    for (const view of this.views) view.setCssSize(view.baseViewport);
    for (const view of this._mounted) this._ensureRendered(view);

    container.scrollTop = anchorRatio * container.scrollHeight - container.clientHeight / 2;
    this.dispatchEvent(new CustomEvent('scalechange', { detail: zoom }));
  }

  zoomIn() {
    this.setZoom(ZOOM_STEPS.find((z) => z > this.zoom + 0.001) ?? ZOOM_STEPS.at(-1));
  }

  zoomOut() {
    this.setZoom([...ZOOM_STEPS].reverse().find((z) => z < this.zoom - 0.001) ?? ZOOM_STEPS[0]);
  }

  fitWidth() {
    const width = this.container.clientWidth - PAGE_GUTTER;
    const zoom = width / (this.defaultBase.width * CSS_UNITS);
    this.setZoom(zoom, { fitMode: 'width' });
    this.dispatchEvent(new CustomEvent('scalechange', { detail: this.zoom }));
  }

  /** @param {number} index page 0-based */
  goToPage(index) {
    const view = this.views[Math.min(this.pageCount - 1, Math.max(0, index))];
    if (!view) return;
    this.container.scrollTop = view.el.offsetTop - 8;
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this._mountObserver?.disconnect();
    this._pageObserver?.disconnect();
    for (const view of this.views) view.destroy();
    this.views = [];
    this.pagesEl.replaceChildren();
  }
}
