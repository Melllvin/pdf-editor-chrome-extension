// Bannières, toasts et dialogues modaux.
import { STR } from './strings-fr.js';

const bannersEl = () => document.getElementById('banners');
const toastsEl = () => document.getElementById('toasts');

/**
 * Affiche une bannière sous la barre d'outils.
 * @param {'error'|'warn'|'info'} kind
 * @param {string} message
 * @param {{label: string, onClick: () => void}[]} [actions]
 * @returns {() => void} fonction de fermeture
 */
export function banner(kind, message, actions = []) {
  const el = document.createElement('div');
  el.className = `banner ${kind}`;
  const msg = document.createElement('span');
  msg.className = 'banner-msg';
  msg.textContent = message;
  el.append(msg);
  for (const { label, onClick } of actions) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      onClick();
      el.remove();
    });
    el.append(btn);
  }
  const close = document.createElement('button');
  close.className = 'banner-close';
  close.title = STR.banners.dismiss;
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.append(close);
  bannersEl().append(el);
  return () => el.remove();
}

export function clearBanners() {
  bannersEl().replaceChildren();
}

export function toast(message, duration = 3500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastsEl().append(el);
  setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => el.remove(), 450);
  }, duration);
}

/**
 * Demande un mot de passe. Résout avec la saisie, ou null si annulé.
 * @param {boolean} isRetry
 * @returns {Promise<string|null>}
 */
export function askPassword(isRetry) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    const h = document.createElement('h2');
    h.textContent = STR.password.title;
    const p = document.createElement('p');
    p.textContent = isRetry ? STR.password.retry : STR.password.prompt;
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const cancel = document.createElement('button');
    cancel.textContent = STR.password.cancel;
    const ok = document.createElement('button');
    ok.className = 'primary';
    ok.textContent = STR.password.ok;
    actions.append(cancel, ok);
    dlg.append(h, p, input, actions);
    document.body.append(dlg);

    const done = (value) => {
      dlg.close();
      dlg.remove();
      resolve(value);
    };
    ok.addEventListener('click', () => done(input.value));
    cancel.addEventListener('click', () => done(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value);
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(null);
    });
    dlg.showModal();
    input.focus();
  });
}

const SHORTCUTS = [
  ['Ctrl+O', 'Ouvrir un fichier'],
  ['Ctrl+S', 'Enregistrer le PDF modifié'],
  ['Ctrl+P', 'Imprimer'],
  ['Ctrl+Z / Ctrl+Y', 'Annuler / Rétablir'],
  ['Suppr', 'Supprimer la sélection'],
  ['Échap', 'Désélectionner, revenir à l’outil Sélection'],
  ['V · T · P · C · S · B', 'Sélection · Texte · Pointillés · Cocher · Surligner · Blanco'],
  ['Ctrl+molette, Ctrl+ + / − / 0', 'Zoom'],
  ['Double-clic sur un texte', 'Modifier le texte'],
];

/** Dialogue listant les raccourcis clavier. */
export function showShortcuts() {
  const dlg = document.createElement('dialog');
  const h = document.createElement('h2');
  h.textContent = 'Raccourcis clavier';
  const table = document.createElement('table');
  table.className = 'shortcuts';
  for (const [keys, label] of SHORTCUTS) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const kbd = document.createElement('kbd');
    kbd.textContent = keys;
    td1.append(kbd);
    const td2 = document.createElement('td');
    td2.textContent = label;
    tr.append(td1, td2);
    table.append(tr);
  }
  const actions = document.createElement('div');
  actions.className = 'dlg-actions';
  const ok = document.createElement('button');
  ok.className = 'primary';
  ok.textContent = 'Fermer';
  ok.addEventListener('click', () => dlg.close());
  actions.append(ok);
  dlg.append(h, table, actions);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

export function showLoading(text = STR.loading) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').hidden = false;
}

export function hideLoading() {
  document.getElementById('loading').hidden = true;
}
