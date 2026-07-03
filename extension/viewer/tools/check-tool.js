// Outil Cocher : un clic pose une coche ✓ (ou croix ✗) centrée sur le clic.
import { makeCheckEdit } from '../edits/types.js';
import { AddEditCommand } from '../edits/commands.js';

const DEFAULT_SIZE = 14; // points PDF

export class CheckTool {
  constructor(ctx) {
    this.ctx = ctx;
  }

  onPointerDown(view, ev, local) {
    ev.preventDefault();
    const { store, stack, settings } = this.ctx;
    const [cx, cy] = view.viewport.convertToPdfPoint(local.x, local.y);
    stack.execute(
      new AddEditCommand(
        store,
        makeCheckEdit({
          pageIndex: view.pageIndex,
          x: cx - DEFAULT_SIZE / 2,
          y: cy - DEFAULT_SIZE / 2,
          size: DEFAULT_SIZE,
          glyph: settings.lastCheckGlyph,
          color: settings.lastColor,
        }),
      ),
    );
  }
}
