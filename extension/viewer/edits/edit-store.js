// Conteneur des éditions du document courant. Émet `change` à chaque mutation
// avec la page concernée ; l'overlay re-rend la page correspondante.

export class EditStore extends EventTarget {
  #map = new Map();

  /** @param {object} edit */
  add(edit) {
    this.#map.set(edit.id, edit);
    this.#emit(edit.pageIndex);
  }

  /** @param {string} id */
  remove(id) {
    const edit = this.#map.get(id);
    if (!edit) return;
    this.#map.delete(id);
    this.#emit(edit.pageIndex);
  }

  /** Fusionne un patch dans l'édition. */
  update(id, patch) {
    const edit = this.#map.get(id);
    if (!edit) return;
    Object.assign(edit, patch);
    this.#emit(edit.pageIndex);
  }

  get(id) {
    return this.#map.get(id);
  }

  /** @returns {object[]} éditions de la page, dans l'ordre de création */
  byPage(pageIndex) {
    return [...this.#map.values()].filter((e) => e.pageIndex === pageIndex);
  }

  all() {
    return [...this.#map.values()];
  }

  get size() {
    return this.#map.size;
  }

  #emit(pageIndex) {
    this.dispatchEvent(new CustomEvent('change', { detail: { pageIndex } }));
  }
}
