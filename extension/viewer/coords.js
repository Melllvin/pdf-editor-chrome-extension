// Conversions entre l'espace CSS d'une page rendue (px, origine haut-gauche)
// et l'espace utilisateur PDF (points, origine bas-gauche). Les éditions sont
// toujours stockées en espace PDF : indépendantes du zoom et de la rotation.

/** @returns {[number, number]} point PDF */
export function cssPointToPdf(viewport, x, y) {
  return viewport.convertToPdfPoint(x, y);
}

/** @returns {[number, number]} point CSS relatif à la page */
export function pdfPointToCss(viewport, x, y) {
  return viewport.convertToViewportPoint(x, y);
}

/** Rect CSS {x,y,w,h} → rect PDF {x,y,w,h} (normalisé, robuste à la rotation). */
export function cssRectToPdfRect(viewport, r) {
  const [x1, y1] = viewport.convertToPdfPoint(r.x, r.y);
  const [x2, y2] = viewport.convertToPdfPoint(r.x + r.w, r.y + r.h);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

/** Rect PDF {x,y,w,h} → rect CSS {x,y,w,h} relatif à la page. */
export function pdfRectToCssRect(viewport, r) {
  const [x1, y1] = viewport.convertToViewportPoint(r.x, r.y);
  const [x2, y2] = viewport.convertToViewportPoint(r.x + r.w, r.y + r.h);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

/** Coordonnées d'un événement pointeur relatives à un élément. */
export function pointerToLocal(el, clientX, clientY) {
  const box = el.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

/** Rect DOMRect (viewport navigateur) → rect CSS relatif à un élément. */
export function domRectToLocal(el, rect) {
  const box = el.getBoundingClientRect();
  return { x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height };
}
