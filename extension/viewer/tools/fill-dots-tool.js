// Outil Pointillés : les suites de points deviennent des zones cliquables ;
// un clic pose un texte à fond blanc SUR la ligne de base des points — le
// texte recouvre les points au fil de la frappe, sans rien déplacer.
import { detectDotZones } from '../dots/dot-detector.js';
import { makeFillEdit, BASELINE_FACTOR } from '../edits/types.js';
import { pdfRectToCssRect } from '../coords.js';
import { STR } from '../ui/strings-fr.js';
import { toast } from '../ui/dialogs.js';

export class FillDotsTool {
  constructor(ctx) {
    this.ctx = ctx;
    this._onRendered = (e) => this.renderZones(e.detail);
  }

  activate() {
    this.ctx.pageManager.addEventListener('pagerendered', this._onRendered);
    let total = 0;
    for (const view of this.ctx.pageManager.views) {
      if (view.rendered) total += this.renderZones(view);
    }
    if (total === 0) toast(STR.toasts.noDots);
  }

  deactivate() {
    this.ctx.pageManager.removeEventListener('pagerendered', this._onRendered);
    for (const view of this.ctx.pageManager.views) view.dotZonesEl.replaceChildren();
  }

  /** @returns {number} nombre de zones affichées */
  renderZones(view) {
    view.dotZonesEl.replaceChildren();
    const zones = detectDotZones(view);
    for (const zone of zones) {
      const r = pdfRectToCssRect(view.viewport, zone.rect);
      const el = document.createElement('div');
      el.className = 'dot-zone';
      el.title = 'Cliquer pour remplir';
      Object.assign(el.style, {
        left: `${r.x - 2}px`,
        top: `${r.y - 2}px`,
        width: `${r.w + 4}px`,
        height: `${r.h + 4}px`,
      });
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.fillZone(view, zone);
      });
      view.dotZonesEl.append(el);
    }
    return zones.length;
  }

  fillZone(view, zone) {
    const { store, overlay, settings } = this.ctx;
    const edit = makeFillEdit({
      pageIndex: view.pageIndex,
      x: zone.rect.x + 1,
      yTop: zone.baselineY + BASELINE_FACTOR * zone.fontSize,
      fontSize: zone.fontSize,
      color: settings.lastColor,
    });
    store.add(edit); // silencieux : l'entrée d'annulation arrive au premier commit
    overlay.beginEditing(edit.id, { isNew: true });
  }
}
