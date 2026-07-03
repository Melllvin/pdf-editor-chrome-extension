// Tracé d'un rectangle élastique sur une page ; commit en espace PDF.
import { cssRectToPdfRect } from '../coords.js';

/**
 * @param {import('../page-view.js').PageView} view
 * @param {PointerEvent} ev événement pointerdown initial
 * @param {{className: string, minSize?: number, onCommit: (pdfRect: {x,y,w,h}) => void}} opts
 */
export function startRubberBand(view, ev, { className, minSize = 4, onCommit }) {
  ev.preventDefault();
  const pageBox = () => view.el.getBoundingClientRect();
  const start = { x: ev.clientX - pageBox().left, y: ev.clientY - pageBox().top };

  const band = document.createElement('div');
  band.className = `rubber-band ${className}`;
  view.editLayerEl.append(band);

  const cssRect = (e) => {
    const box = pageBox();
    const cur = { x: e.clientX - box.left, y: e.clientY - box.top };
    return {
      x: Math.min(start.x, cur.x),
      y: Math.min(start.y, cur.y),
      w: Math.abs(cur.x - start.x),
      h: Math.abs(cur.y - start.y),
    };
  };

  const onMove = (e) => {
    const r = cssRect(e);
    Object.assign(band.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.w}px`,
      height: `${r.h}px`,
    });
  };

  const onUp = (e) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    band.remove();
    const r = cssRect(e);
    if (r.w >= minSize && r.h >= minSize) {
      onCommit(cssRectToPdfRect(view.viewport, r));
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
