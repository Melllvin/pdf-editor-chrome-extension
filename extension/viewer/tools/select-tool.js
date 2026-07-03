// Outil Sélection : cliquer une édition la sélectionne (géré par edit-element),
// cliquer le vide désélectionne. Le glisser/redimensionner vit dans edit-element.

export class SelectTool {
  constructor(ctx) {
    this.ctx = ctx;
  }

  onPointerDown() {
    // Les .edit-box interceptent leur pointerdown (stopPropagation) :
    // arriver ici signifie un clic sur une zone vide de la page.
    this.ctx.overlay.deselect();
  }
}
