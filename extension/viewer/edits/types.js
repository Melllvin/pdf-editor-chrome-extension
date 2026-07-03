// Fabriques des éditions. Toutes les coordonnées sont en ESPACE PDF
// (points, origine bas-gauche de la page) — indépendantes du zoom.

let counter = 0;
const genId = () => `edit-${++counter}-${Date.now().toString(36)}`;

/**
 * Texte libre. Ancré par son coin HAUT-gauche (x, yTop) en espace PDF.
 * `baselineY` (optionnel) force la ligne de base de la première ligne —
 * utilisé par le remplissage des pointillés pour poser le texte sur la ligne.
 */
export function makeTextEdit({
  pageIndex,
  x,
  yTop,
  text = '',
  fontSize = 12,
  color = '#000000',
  whiteBg = false,
  baselineY = null,
}) {
  return { id: genId(), type: 'text', pageIndex, x, yTop, text, fontSize, color, whiteBg, baselineY };
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
/** Part de la taille de police au-dessus de la ligne de base (approx. Helvetica). */
export const ASCENT_FACTOR = 0.8;
