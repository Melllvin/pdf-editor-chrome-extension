// Détection des lignes pointillées (« Nom : ......... », « . . . . », « ____ »)
// dans la couche texte, avec géométrie exacte via DOM Range.
import { cssRectToPdfRect, domRectToLocal } from '../coords.js';

// Points, points de suite espacés, ellipses, points médians, underscores.
const DOT_RUN = /[.…·_](?:[  \t]{0,2}[.…·_]){2,}/g;

// Métriques Arial/Liberation (cohérentes avec BASELINE_FACTOR de types.js)
const FONT_BOX = 0.905 + 0.212; // ascendante + descendante (em)
const DESCENT_SHARE = 0.212 / FONT_BOX; // part de la descendante dans la boîte

/**
 * @param {import('../page-view.js').PageView} view page rendue
 * @returns {{rect: {x,y,w,h}, baselineY: number, fontSize: number}[]} zones en espace PDF
 */
export function detectDotZones(view) {
  const zones = [];
  for (const span of view.textLayerEl.querySelectorAll('span')) {
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue) continue;
    const str = node.nodeValue;
    for (const match of str.matchAll(DOT_RUN)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const r = range.getBoundingClientRect();
      range.detach?.();
      if (r.width < 8 || r.height < 2) continue;
      const rect = cssRectToPdfRect(view.viewport, domRectToLocal(view.el, r));
      // La boîte du fragment couvre ascendante+descendante : la ligne de base
      // des points est au-dessus de la descendante.
      const baselineY = rect.y + rect.h * DESCENT_SHARE;
      const fontSize = clamp(Math.round(rect.h / FONT_BOX), 8, 16);
      zones.push({ rect, baselineY, fontSize });
    }
  }
  return mergeAdjacent(zones);
}

/** Les lignes de points sont souvent fragmentées en plusieurs items pdf.js. */
function mergeAdjacent(zones) {
  zones.sort((a, b) => b.baselineY - a.baselineY || a.rect.x - b.rect.x);
  const out = [];
  for (const z of zones) {
    const prev = out.at(-1);
    if (
      prev &&
      Math.abs(prev.baselineY - z.baselineY) < 1.5 &&
      z.rect.x - (prev.rect.x + prev.rect.w) < 6 &&
      z.rect.x - (prev.rect.x + prev.rect.w) > -2
    ) {
      const right = Math.max(prev.rect.x + prev.rect.w, z.rect.x + z.rect.w);
      const top = Math.max(prev.rect.y + prev.rect.h, z.rect.y + z.rect.h);
      prev.rect.y = Math.min(prev.rect.y, z.rect.y);
      prev.rect.w = right - prev.rect.x;
      prev.rect.h = top - prev.rect.y;
    } else {
      out.push(z);
    }
  }
  return out;
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
