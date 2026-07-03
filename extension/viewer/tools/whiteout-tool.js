// Outil Blanco : tracer un rectangle blanc qui masque le contenu au-dessous.
import { makeWhiteoutEdit } from '../edits/types.js';
import { AddEditCommand } from '../edits/commands.js';
import { startRubberBand } from './rubber-band.js';

export class WhiteoutTool {
  constructor(ctx) {
    this.ctx = ctx;
  }

  onPointerDown(view, ev) {
    const { store, stack } = this.ctx;
    startRubberBand(view, ev, {
      className: 'rubber-whiteout',
      onCommit: (r) => {
        stack.execute(
          new AddEditCommand(
            store,
            makeWhiteoutEdit({ pageIndex: view.pageIndex, x: r.x, y: r.y, w: r.w, h: r.h }),
          ),
        );
      },
    });
  }
}
