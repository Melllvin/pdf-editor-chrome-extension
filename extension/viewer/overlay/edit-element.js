// Construit l'élément DOM d'une édition et ses comportements :
// sélection, glisser, poignée de redimensionnement, édition de texte en place.
import { pdfRectToCssRect, cssRectToPdfRect } from '../coords.js';
import { LINE_HEIGHT_FACTOR } from '../edits/types.js';
import {
  AddEditCommand,
  RemoveEditCommand,
  UpdateEditCommand,
} from '../edits/commands.js';

const DRAG_THRESHOLD = 3; // px avant de considérer un glisser

/**
 * @param {object} edit
 * @param {{
 *   view: import('../page-view.js').PageView,
 *   store: import('../edits/edit-store.js').EditStore,
 *   stack: import('../edits/commands.js').CommandStack,
 *   overlay: any,
 * }} ctx
 */
export function createEditElement(edit, ctx) {
  const el = document.createElement('div');
  el.className = `edit-box edit-${edit.type}`;
  el.dataset.editId = edit.id;

  switch (edit.type) {
    case 'text':
    case 'fill':
      buildText(el, edit, ctx);
      break;
    case 'check':
      buildCheck(el, edit, ctx);
      break;
    case 'whiteout':
      buildWhiteout(el, edit, ctx);
      break;
    default:
      return el;
  }

  if (ctx.overlay.selectedId === edit.id) {
    el.classList.add('selected');
    el.append(makeResizeHandle(el, edit, ctx));
  }

  el.addEventListener('pointerdown', (ev) => onPointerDown(ev, el, edit, ctx));
  el.addEventListener('dblclick', (ev) => {
    if (edit.type === 'text' || edit.type === 'fill') {
      ev.stopPropagation();
      ctx.overlay.beginEditing(edit.id);
    }
  });

  return el;
}

// ---------- Construction par type ----------

function textCssRect(edit, viewport) {
  const [left, top] = viewport.convertToViewportPoint(edit.x, edit.yTop);
  return { left, top };
}

function buildText(el, edit, ctx) {
  const { viewport } = ctx.view;
  const { left, top } = textCssRect(edit, viewport);
  const scale = viewport.scale;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.fontSize = `${edit.fontSize * scale}px`;
  el.style.lineHeight = String(LINE_HEIGHT_FACTOR);
  el.style.color = edit.color;
  if (edit.whiteBg) el.classList.add('white-bg');
  el.textContent = edit.text;
}

function buildCheck(el, edit, ctx) {
  const r = pdfRectToCssRect(ctx.view.viewport, { x: edit.x, y: edit.y, w: edit.size, h: edit.size });
  Object.assign(el.style, {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  });
  el.innerHTML =
    edit.glyph === 'cross'
      ? `<svg viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16"/></svg>`
      : `<svg viewBox="0 0 20 20"><path d="M3 11 L8 16 L17 4"/></svg>`;
  const path = el.querySelector('path');
  path.setAttribute('stroke', edit.color);
  path.setAttribute('stroke-width', '2.4');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('fill', 'none');
}

function buildWhiteout(el, edit, ctx) {
  const r = pdfRectToCssRect(ctx.view.viewport, edit);
  Object.assign(el.style, {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  });
}

// ---------- Sélection + glisser ----------

function onPointerDown(ev, el, edit, ctx) {
  if (ev.button !== 0) return;
  if (el.classList.contains('editing')) return; // caret de texte natif
  const tool = document.body.dataset.tool ?? 'select';

  if (tool === 'text' && (edit.type === 'text' || edit.type === 'fill')) {
    ev.stopPropagation();
    ev.preventDefault();
    ctx.overlay.beginEditing(edit.id);
    return;
  }
  if (tool !== 'select') return; // les autres outils passent au travers (CSS)

  ev.stopPropagation();
  ev.preventDefault();
  ctx.overlay.select(edit.id);

  // Glisser : translation visuelle, commit en espace PDF au relâchement.
  const startX = ev.clientX;
  const startY = ev.clientY;
  const startLeft = parseFloat(el.style.left);
  const startTop = parseFloat(el.style.top);
  let dragging = false;

  const onMove = (mv) => {
    const dx = mv.clientX - startX;
    const dy = mv.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    el.style.left = `${startLeft + dx}px`;
    el.style.top = `${startTop + dy}px`;
  };

  const onUp = (up) => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    if (!dragging) return;
    const dx = up.clientX - startX;
    const dy = up.clientY - startY;
    commitMove(edit, ctx, dx, dy, { startLeft, startTop });
  };

  el.setPointerCapture(ev.pointerId);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
}

function commitMove(edit, ctx, dx, dy, { startLeft, startTop }) {
  const { viewport } = ctx.view;
  if (edit.type === 'text' || edit.type === 'fill') {
    const [x, yTop] = viewport.convertToPdfPoint(startLeft + dx, startTop + dy);
    const before = { x: edit.x, yTop: edit.yTop, baselineY: edit.baselineY };
    // Le déplacement invalide l'ancrage à la ligne de base des pointillés :
    // on le remplace par un décalage équivalent pour préserver l'apparence.
    const after = {
      x,
      yTop,
      baselineY: edit.baselineY === null ? null : edit.baselineY + (yTop - edit.yTop),
    };
    ctx.store.update(edit.id, after);
    ctx.stack.pushApplied(new UpdateEditCommand(ctx.store, edit.id, before, after));
  } else {
    const cssRect = pdfRectToCssRect(viewport, rectOf(edit));
    const moved = cssRectToPdfRect(viewport, { ...cssRect, x: cssRect.x + dx, y: cssRect.y + dy });
    const before = { x: edit.x, y: edit.y };
    const after = { x: moved.x, y: moved.y };
    ctx.store.update(edit.id, after);
    ctx.stack.pushApplied(new UpdateEditCommand(ctx.store, edit.id, before, after));
  }
}

const rectOf = (edit) =>
  edit.type === 'check'
    ? { x: edit.x, y: edit.y, w: edit.size, h: edit.size }
    : { x: edit.x, y: edit.y, w: edit.w, h: edit.h };

// ---------- Poignée de redimensionnement ----------

function makeResizeHandle(el, edit, ctx) {
  const handle = document.createElement('span');
  handle.className = 'edit-handle se';
  handle.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const startY = ev.clientY;
    const startX = ev.clientX;
    const startH = el.getBoundingClientRect().height;
    const startW = el.getBoundingClientRect().width;

    const apply = (mv) => {
      const factor = Math.max(0.2, (startH + (mv.clientY - startY)) / startH);
      return factor;
    };

    const onMove = (mv) => {
      const factor = apply(mv);
      if (edit.type === 'text' || edit.type === 'fill') {
        el.style.fontSize = `${edit.fontSize * ctx.view.viewport.scale * factor}px`;
      } else if (edit.type === 'check') {
        el.style.width = `${startW * factor}px`;
        el.style.height = `${startH * factor}px`;
      } else if (edit.type === 'whiteout') {
        el.style.width = `${Math.max(6, startW + (mv.clientX - startX))}px`;
        el.style.height = `${Math.max(6, startH + (mv.clientY - startY))}px`;
      }
    };

    const onUp = (up) => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      const { viewport } = ctx.view;
      if (edit.type === 'text' || edit.type === 'fill') {
        const factor = apply(up);
        const fontSize = clamp(Math.round(edit.fontSize * factor), 6, 72);
        pushUpdate(ctx, edit, { fontSize: edit.fontSize }, { fontSize });
      } else if (edit.type === 'check') {
        const factor = apply(up);
        const size = clamp(edit.size * factor, 6, 200);
        pushUpdate(ctx, edit, { size: edit.size }, { size });
      } else if (edit.type === 'whiteout') {
        const cssRect = pdfRectToCssRect(viewport, rectOf(edit));
        const resized = cssRectToPdfRect(viewport, {
          ...cssRect,
          w: Math.max(6, cssRect.w + (up.clientX - startX)),
          h: Math.max(6, cssRect.h + (up.clientY - startY)),
        });
        // Coin haut-gauche CSS fixe : x et y (bas) bougent avec la hauteur
        pushUpdate(
          ctx,
          edit,
          { x: edit.x, y: edit.y, w: edit.w, h: edit.h },
          { x: resized.x, y: resized.y, w: resized.w, h: resized.h },
        );
      }
    };

    handle.setPointerCapture(ev.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
  return handle;
}

function pushUpdate(ctx, edit, before, after) {
  ctx.store.update(edit.id, after);
  ctx.stack.pushApplied(new UpdateEditCommand(ctx.store, edit.id, before, after));
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ---------- Édition de texte en place ----------

/**
 * Passe l'élément en contenteditable. `isNew` : l'édition vient d'être créée
 * par l'outil Texte et n'est pas encore dans la pile d'annulation.
 */
export function startInlineEdit(el, edit, ctx, { isNew = false } = {}) {
  el.classList.add('editing');
  el.setAttribute('contenteditable', 'plaintext-only');
  const before = { text: edit.text };
  el.focus();
  placeCaretAtEnd(el);

  const commit = () => {
    el.removeEventListener('keydown', onKey);
    el.classList.remove('editing');
    el.removeAttribute('contenteditable');
    const text = normalizeText(el.innerText);

    if (isNew) {
      if (!text) {
        ctx.store.remove(edit.id); // jamais existé : ni commande, ni trace
        return;
      }
      ctx.store.update(edit.id, { text });
      ctx.stack.pushApplied(new AddEditCommand(ctx.store, ctx.store.get(edit.id)));
      ctx.overlay.select(edit.id);
      ctx.overlay.requestTool?.('select');
      return;
    }

    if (!text) {
      ctx.stack.execute(new RemoveEditCommand(ctx.store, edit));
      ctx.overlay.deselect();
      return;
    }
    if (text !== before.text) {
      ctx.store.update(edit.id, { text });
      ctx.stack.pushApplied(new UpdateEditCommand(ctx.store, edit.id, before, { text }));
    } else {
      ctx.overlay.renderPage(ctx.view); // restaure l'état non éditable
    }
  };

  const onKey = (ev) => {
    ev.stopPropagation(); // ne pas déclencher les raccourcis globaux en tapant
    if (ev.key === 'Escape') {
      ev.preventDefault();
      el.blur();
    }
  };

  el.addEventListener('blur', commit, { once: true });
  el.addEventListener('keydown', onKey);
}

function normalizeText(raw) {
  return (raw ?? '')
    .replace(/\u00A0/g, ' ') // les insécables du contenteditable redeviennent des espaces
    .replace(/\n+$/, '')
    .trimEnd();
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
