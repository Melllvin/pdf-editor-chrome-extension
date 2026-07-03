// Outil actif, routage des événements pointeur vers les pages, et barre
// d'options contextuelle (réglages de l'outil ou de l'édition sélectionnée).
import { UpdateEditCommand } from '../edits/commands.js';
import { setSetting } from '../ui/settings.js';

const TEXT_COLORS = ['#000000', '#1a53d8', '#c62828', '#1b7a2f'];
const HIGHLIGHT_COLORS = ['#ffeb3b', '#a5e879', '#8ecbff', '#ffa6d6'];

export class ToolManager extends EventTarget {
  /**
   * @param {{
   *   pagesEl: HTMLElement,
   *   pageManager: import('../page-manager.js').PageManager,
   *   store: import('../edits/edit-store.js').EditStore,
   *   stack: import('../edits/commands.js').CommandStack,
   *   overlay: import('../overlay/overlay.js').Overlay,
   *   settings: Record<string, any>,
   * }} ctx
   */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.tools = new Map();
    this.activeName = null;
    this.active = null;

    ctx.overlay.requestTool = (name) => this.setTool(name);
    ctx.overlay.addEventListener('selectionchange', () => this.renderOptions());

    ctx.pagesEl.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const pageEl = ev.target.closest?.('.page');
      if (!pageEl) return;
      const view = ctx.pageManager.views[Number(pageEl.dataset.pageIndex)];
      if (!view?.rendered) return;
      const box = pageEl.getBoundingClientRect();
      const local = { x: ev.clientX - box.left, y: ev.clientY - box.top };
      this.active?.onPointerDown?.(view, ev, local);
    });
  }

  register(name, tool) {
    this.tools.set(name, tool);
  }

  setTool(name) {
    if (!this.tools.has(name) || this.activeName === name) return;
    this.active?.deactivate?.();
    this.activeName = name;
    this.active = this.tools.get(name);
    document.body.dataset.tool = name;
    this.active?.activate?.();
    this.dispatchEvent(new CustomEvent('toolchange', { detail: name }));
    this.renderOptions();
  }

  // ---------- Barre d'options contextuelle ----------

  renderOptions() {
    const bar = document.getElementById('toolOptions');
    bar.replaceChildren();
    const selected = this.ctx.overlay.selected;
    const kind = selected
      ? selected.type === 'fill'
        ? 'text'
        : selected.type
      : this.activeName === 'dots'
        ? 'text'
        : this.activeName;

    if (kind === 'text') this.#textOptions(bar, selected);
    else if (kind === 'check') this.#checkOptions(bar, selected);
    else if (kind === 'highlight') this.#highlightOptions(bar, selected);

    if (selected) {
      const del = document.createElement('button');
      del.className = 'opt-btn opt-danger';
      del.textContent = 'Supprimer';
      del.title = 'Supprimer la sélection (Suppr)';
      del.addEventListener('click', () => this.ctx.overlay.deleteSelected());
      bar.append(del);
    }

    const hasContent = bar.childElementCount > 0;
    bar.hidden = !hasContent;
    document.body.classList.toggle('has-tool-options', hasContent);
  }

  /** Applique une propriété à l'édition sélectionnée (annulable) ou aux réglages. */
  #apply(selected, key, value, settingKey) {
    if (selected) {
      this.ctx.stack.execute(
        new UpdateEditCommand(this.ctx.store, selected.id, { [key]: selected[key] }, { [key]: value }),
      );
    }
    if (settingKey) {
      this.ctx.settings[settingKey] = value;
      setSetting(settingKey, value);
    }
  }

  #label(bar, text) {
    const span = document.createElement('span');
    span.className = 'opt-label';
    span.textContent = text;
    bar.append(span);
  }

  #swatches(bar, colors, current, onPick) {
    const wrap = document.createElement('span');
    wrap.className = 'opt-swatches';
    for (const color of colors) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      if (color === current) b.classList.add('selected');
      b.addEventListener('click', () => {
        onPick(color);
        this.renderOptions();
      });
      wrap.append(b);
    }
    bar.append(wrap);
  }

  #textOptions(bar, selected) {
    const s = this.ctx.settings;
    this.#label(bar, 'Taille');
    const size = document.createElement('input');
    size.type = 'number';
    size.min = '6';
    size.max = '72';
    size.value = String(selected?.fontSize ?? s.lastFontSize);
    size.addEventListener('change', () => {
      const v = Math.min(72, Math.max(6, Number(size.value) || 12));
      this.#apply(selected, 'fontSize', v, 'lastFontSize');
    });
    bar.append(size);

    this.#swatches(bar, TEXT_COLORS, selected?.color ?? s.lastColor, (c) =>
      this.#apply(selected, 'color', c, 'lastColor'),
    );

    const bgLabel = document.createElement('label');
    bgLabel.className = 'opt-check';
    const bg = document.createElement('input');
    bg.type = 'checkbox';
    bg.checked = selected ? selected.whiteBg : Boolean(s.lastWhiteBg);
    bg.addEventListener('change', () => this.#apply(selected, 'whiteBg', bg.checked, 'lastWhiteBg'));
    bgLabel.append(bg, document.createTextNode(' Fond blanc'));
    bar.append(bgLabel);
  }

  #checkOptions(bar, selected) {
    const s = this.ctx.settings;
    const current = selected?.glyph ?? s.lastCheckGlyph;
    for (const [glyph, symbol, title] of [
      ['check', '✓', 'Coche'],
      ['cross', '✗', 'Croix'],
    ]) {
      const b = document.createElement('button');
      b.className = 'opt-btn opt-glyph';
      b.textContent = symbol;
      b.title = title;
      if (current === glyph) b.classList.add('active');
      b.addEventListener('click', () => {
        this.#apply(selected, 'glyph', glyph, 'lastCheckGlyph');
        this.renderOptions();
      });
      bar.append(b);
    }
    this.#swatches(bar, TEXT_COLORS, selected?.color ?? s.lastColor, (c) =>
      this.#apply(selected, 'color', c, 'lastColor'),
    );
  }

  #highlightOptions(bar, selected) {
    const s = this.ctx.settings;
    this.#label(bar, 'Couleur');
    this.#swatches(bar, HIGHLIGHT_COLORS, selected?.color ?? s.lastHighlightColor, (c) =>
      this.#apply(selected, 'color', c, 'lastHighlightColor'),
    );
  }
}
