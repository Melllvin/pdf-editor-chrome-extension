// Rend le contenu de l'EditStore dans les couches DOM des pages, et gère la
// sélection courante (une seule édition sélectionnée à la fois en v1).
import { createEditElement, startInlineEdit } from './edit-element.js';
import { pdfRectToCssRect } from '../coords.js';
import { RemoveEditCommand } from '../edits/commands.js';

export class Overlay extends EventTarget {
  /**
   * @param {{
   *   store: import('../edits/edit-store.js').EditStore,
   *   stack: import('../edits/commands.js').CommandStack,
   *   pageManager: import('../page-manager.js').PageManager,
   * }} opts
   */
  constructor({ store, stack, pageManager }) {
    super();
    this.store = store;
    this.stack = stack;
    this.pageManager = pageManager;
    this.selectedId = null;
    /** demandé par les éléments (retour à l'outil Sélection après création) */
    this.requestTool = null;

    pageManager.addEventListener('pagerendered', (e) => this.renderPage(e.detail));
    store.addEventListener('change', (e) => {
      const view = pageManager.views[e.detail.pageIndex];
      if (view?.rendered) this.renderPage(view);
    });
  }

  /** Reconstruit les couches d'édition d'une page depuis le store. */
  renderPage(view) {
    const ctx = { view, store: this.store, stack: this.stack, overlay: this };
    view.editLayerEl.replaceChildren();
    view.highlightLayerEl.replaceChildren();
    for (const edit of this.store.byPage(view.pageIndex)) {
      if (edit.type === 'highlight') {
        view.highlightLayerEl.append(this.#renderHighlight(edit, view));
      } else {
        view.editLayerEl.append(createEditElement(edit, ctx));
      }
    }
  }

  #renderHighlight(edit, view) {
    const group = document.createElement('div');
    group.className = 'edit-box edit-highlight';
    group.dataset.editId = edit.id;
    if (this.selectedId === edit.id) group.classList.add('selected');
    for (const rect of edit.rects) {
      const r = pdfRectToCssRect(view.viewport, rect);
      const div = document.createElement('div');
      div.className = 'highlight-rect';
      Object.assign(div.style, {
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.w}px`,
        height: `${r.h}px`,
        background: edit.color,
      });
      group.append(div);
    }
    group.addEventListener('pointerdown', (ev) => {
      if (document.body.dataset.tool !== 'select' || ev.button !== 0) return;
      ev.stopPropagation();
      this.select(edit.id);
    });
    return group;
  }

  select(id) {
    if (this.selectedId === id) return;
    const previous = this.selectedId;
    this.selectedId = id;
    this.#refresh(previous);
    this.#refresh(id);
    this.dispatchEvent(new CustomEvent('selectionchange', { detail: this.selected }));
  }

  deselect() {
    this.select(null);
  }

  get selected() {
    return this.selectedId ? this.store.get(this.selectedId) : null;
  }

  deleteSelected() {
    const edit = this.selected;
    if (!edit) return;
    this.stack.execute(new RemoveEditCommand(this.store, edit));
    this.selectedId = null;
    this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
  }

  /** Passe une édition texte en mode saisie (élément déjà rendu). */
  beginEditing(id, { isNew = false } = {}) {
    const edit = this.store.get(id);
    if (!edit) return;
    const view = this.pageManager.views[edit.pageIndex];
    const el = view?.editLayerEl.querySelector(`[data-edit-id="${CSS.escape(id)}"]`);
    if (!el) return;
    startInlineEdit(el, edit, { view, store: this.store, stack: this.stack, overlay: this }, { isNew });
  }

  /** Re-rend la page contenant l'édition donnée (ou tout si null). */
  #refresh(id) {
    if (!id) return;
    const edit = this.store.get(id);
    if (!edit) return;
    const view = this.pageManager.views[edit.pageIndex];
    if (view?.rendered) this.renderPage(view);
  }
}
