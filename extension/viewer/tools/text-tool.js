// Outil Texte : un clic crée une zone de texte immédiatement éditable.
// L'édition n'entre dans la pile d'annulation qu'au premier texte non vide.
import { makeTextEdit } from '../edits/types.js';

export class TextTool {
  constructor(ctx) {
    this.ctx = ctx;
  }

  onPointerDown(view, ev, local) {
    ev.preventDefault();
    const { settings, store, overlay } = this.ctx;
    const [x, yTop] = view.viewport.convertToPdfPoint(local.x, local.y);
    const edit = makeTextEdit({
      pageIndex: view.pageIndex,
      x,
      yTop,
      fontSize: settings.lastFontSize,
      color: settings.lastColor,
      whiteBg: Boolean(settings.lastWhiteBg),
    });
    store.add(edit); // silencieux : pas encore d'entrée d'annulation
    overlay.beginEditing(edit.id, { isNew: true });
  }
}
