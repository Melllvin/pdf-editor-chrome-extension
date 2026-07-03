// Outil Surligner : la sélection de texte native devient des rectangles de
// surlignage fusionnés par ligne ; hors texte, repli en rectangle libre.
import { makeHighlightEdit } from '../edits/types.js';
import { AddEditCommand } from '../edits/commands.js';
import { cssRectToPdfRect, domRectToLocal } from '../coords.js';
import { startRubberBand } from './rubber-band.js';

export class HighlightTool {
  constructor(ctx) {
    this.ctx = ctx;
    this._onUp = () => setTimeout(() => this.commitSelection(), 0);
  }

  activate() {
    window.addEventListener('pointerup', this._onUp);
    // « Sélectionner d'abord, surligner ensuite » : une sélection déjà
    // présente au moment d'activer l'outil est convertie immédiatement.
    this.commitSelection();
  }

  deactivate() {
    window.removeEventListener('pointerup', this._onUp);
  }

  onPointerDown(view, ev) {
    // Sur du texte : laisser la sélection native se faire (commit au pointerup).
    if (ev.target.closest?.('.textLayer')) return;
    // Hors texte : rectangle libre.
    const { store, stack, settings } = this.ctx;
    startRubberBand(view, ev, {
      className: 'rubber-highlight',
      onCommit: (r) => {
        stack.execute(
          new AddEditCommand(
            store,
            makeHighlightEdit({
              pageIndex: view.pageIndex,
              rects: [r],
              color: settings.lastHighlightColor,
            }),
          ),
        );
      },
    });
  }

  /** Convertit la sélection courante en surlignages (une édition par page). */
  commitSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const { pageManager, store, stack, settings } = this.ctx;
    let created = false;
    for (const view of pageManager.views) {
      if (!view.rendered) continue;
      const rects = selectionRectsForView(sel, view);
      if (!rects.length) continue;
      stack.execute(
        new AddEditCommand(
          store,
          makeHighlightEdit({
            pageIndex: view.pageIndex,
            rects,
            color: settings.lastHighlightColor,
          }),
        ),
      );
      created = true;
    }
    if (created) sel.removeAllRanges();
  }
}

/** Rects de la sélection dans une page : filtrés, dédupliqués, fusionnés par ligne. */
function selectionRectsForView(sel, view) {
  const pageBox = view.textLayerEl.getBoundingClientRect();
  let rects = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    for (const r of sel.getRangeAt(i).getClientRects()) {
      if (r.width < 1.5 || r.height < 1.5) continue;
      if (r.right < pageBox.left || r.left > pageBox.right) continue;
      if (r.bottom < pageBox.top || r.top > pageBox.bottom) continue;
      rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
  }
  if (!rects.length) return [];

  // Chrome renvoie à la fois les boîtes d'éléments entiers et les fragments de
  // texte : on écarte doublons et boîtes englobantes.
  rects = dedupe(rects);
  rects = rects.filter((a) => !rects.some((b) => a !== b && contains(a, b)));

  // Fusion par ligne (groupe sur le centre vertical)
  rects.sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2 || a.left - b.left);
  const lines = [];
  for (const r of rects) {
    const cy = (r.top + r.bottom) / 2;
    const h = r.bottom - r.top;
    const line = lines.find((l) => Math.abs(l.cy - cy) < 0.4 * Math.max(h, l.h));
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
      line.cy = (line.top + line.bottom) / 2;
      line.h = line.bottom - line.top;
    } else {
      lines.push({ ...r, cy, h });
    }
  }

  return lines.map((l) => {
    const local = domRectToLocal(view.el, {
      left: l.left,
      top: l.top - 1,
      width: l.right - l.left,
      height: l.bottom - l.top + 2,
    });
    return cssRectToPdfRect(view.viewport, local);
  });
}

const contains = (outer, inner) =>
  outer.left <= inner.left + 1 &&
  outer.right >= inner.right - 1 &&
  outer.top <= inner.top + 1 &&
  outer.bottom >= inner.bottom - 1 &&
  (outer.right - outer.left > inner.right - inner.left + 2 ||
    outer.bottom - outer.top > inner.bottom - inner.top + 2);

function dedupe(rects) {
  const out = [];
  for (const r of rects) {
    if (
      !out.some(
        (o) =>
          Math.abs(o.left - r.left) < 1 &&
          Math.abs(o.right - r.right) < 1 &&
          Math.abs(o.top - r.top) < 1 &&
          Math.abs(o.bottom - r.bottom) < 1,
      )
    ) {
      out.push(r);
    }
  }
  return out;
}
