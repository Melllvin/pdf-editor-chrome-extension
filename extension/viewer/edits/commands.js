// Pile annuler/rétablir. Deux entrées :
//  - execute(cmd)     : applique la commande puis l'empile ;
//  - pushApplied(cmd) : empile une commande DÉJÀ appliquée à l'écran
//    (frappe regroupée, fin de glisser…) — do() ne sera appelé qu'au rétablir.

export class CommandStack extends EventTarget {
  #undo = [];
  #redo = [];
  #savedDepth = 0;

  execute(cmd) {
    cmd.do();
    this.#push(cmd);
  }

  pushApplied(cmd) {
    this.#push(cmd);
  }

  #push(cmd) {
    this.#undo.push(cmd);
    this.#redo.length = 0;
    // Un enregistrement suivi d'annulations ne peut plus retomber sur le même état
    if (this.#savedDepth > this.#undo.length - 1) this.#savedDepth = -1;
    this.#emit();
  }

  undo() {
    const cmd = this.#undo.pop();
    if (!cmd) return;
    cmd.undo();
    this.#redo.push(cmd);
    this.#emit();
  }

  redo() {
    const cmd = this.#redo.pop();
    if (!cmd) return;
    cmd.do();
    this.#undo.push(cmd);
    this.#emit();
  }

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  /** Des modifications non enregistrées existent-elles ? */
  get dirty() {
    return this.#undo.length !== this.#savedDepth;
  }

  markSaved() {
    this.#savedDepth = this.#undo.length;
    this.#emit();
  }

  #emit() {
    this.dispatchEvent(new Event('change'));
  }
}

export class AddEditCommand {
  constructor(store, edit) {
    this.store = store;
    this.edit = edit;
  }
  do() {
    this.store.add(this.edit);
  }
  undo() {
    this.store.remove(this.edit.id);
  }
}

export class RemoveEditCommand {
  constructor(store, edit) {
    this.store = store;
    this.edit = edit;
  }
  do() {
    this.store.remove(this.edit.id);
  }
  undo() {
    this.store.add(this.edit);
  }
}

export class UpdateEditCommand {
  /** @param {object} before patch d'origine  @param {object} after patch appliqué */
  constructor(store, id, before, after) {
    this.store = store;
    this.id = id;
    this.before = before;
    this.after = after;
  }
  do() {
    this.store.update(this.id, this.after);
  }
  undo() {
    this.store.update(this.id, this.before);
  }
}
