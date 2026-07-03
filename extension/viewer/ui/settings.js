// Réglages persistants (chrome.storage.sync), avec repli mémoire hors extension.
const DEFAULTS = {
  interceptPdf: true,
  lastFontSize: 12,
  lastColor: '#000000',
  lastWhiteBg: false,
  lastHighlightColor: '#ffeb3b',
  lastCheckGlyph: 'check',
};

const memory = { ...DEFAULTS };
const hasStorage = typeof chrome !== 'undefined' && chrome.storage?.sync;

export async function getSettings() {
  if (!hasStorage) return { ...memory };
  return chrome.storage.sync.get(DEFAULTS);
}

export async function setSetting(key, value) {
  memory[key] = value;
  if (hasStorage) await chrome.storage.sync.set({ [key]: value });
}

/** @param {(changes: Record<string, {newValue: unknown}>) => void} cb */
export function onSettingsChanged(cb) {
  if (!hasStorage) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') cb(changes);
  });
}
