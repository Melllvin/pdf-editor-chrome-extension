// Fabriques des éditions. Toutes les coordonnées sont en ESPACE PDF
// (points, origine bas-gauche de la page) — indépendantes du zoom.

let counter = 0;
const genId = () => `edit-${++counter}-${Date.now().toString(36)}`;

/**
 * Texte libre. Ancré par son coin HAUT-gauche (x, yTop) en espace PDF.
 * La ligne de base de la première ligne est à yTop − fontSize × BASELINE_FACTOR,
 * à l'écran comme à l'export.
 */
export function makeTextEdit({
  pageIndex,
  x,
  yTop,
  text = '',
  fontSize = 12,
  color = '#000000',
  whiteBg = false,
}) {
  return { id: genId(), type: 'text', pageIndex, x, yTop, text, fontSize, color, whiteBg };
}

/** Remplissage d'une ligne pointillée : un texte à fond blanc posé sur la ligne. */
export function makeFillEdit(opts) {
  return { ...makeTextEdit({ ...opts, whiteBg: true }), type: 'fill' };
}

/** Coche ✓ ou croix ✗. Rect carré {x, y (bas), size} en espace PDF. */
export function makeCheckEdit({ pageIndex, x, y, size = 14, glyph = 'check', color = '#000000' }) {
  return { id: genId(), type: 'check', pageIndex, x, y, size, glyph, color };
}

/** Surlignage : rectangles fusionnés par ligne, en espace PDF. */
export function makeHighlightEdit({ pageIndex, rects, color = '#ffeb3b' }) {
  return { id: genId(), type: 'highlight', pageIndex, rects, color };
}

/** Blanco : rectangle blanc opaque {x, y (bas), w, h} en espace PDF. */
export function makeWhiteoutEdit({ pageIndex, x, y, w, h }) {
  return { id: genId(), type: 'whiteout', pageIndex, x, y, w, h };
}

/** Hauteur d'interligne du texte incrusté (partagé écran / export). */
export const LINE_HEIGHT_FACTOR = 1.2;
/**
 * Distance entre le HAUT de la boîte de texte et la ligne de base de la
 * première ligne, en parts de la taille de police. Reproduit le placement CSS
 * (Arial/Liberation : ascendante hhea ≈ 0,905 em, descendante ≈ 0,212 em,
 * demi-interlignage avec line-height 1,2) pour que l'incrustation pdf-lib
 * tombe exactement où l'aperçu affichait le texte.
 */
export const BASELINE_FACTOR = (LINE_HEIGHT_FACTOR - (0.905 + 0.212)) / 2 + 0.905;
