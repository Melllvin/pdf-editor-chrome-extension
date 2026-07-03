// Service worker MV3 : interception des PDF vers le viewer, menus contextuels, action.

const REDIRECT_RULE_ID = 1;

const viewerUrl = () => chrome.runtime.getURL('viewer/viewer.html');
const viewerUrlFor = (target) => `${viewerUrl()}?file=${encodeURIComponent(target)}`;

async function isInterceptionEnabled() {
  const { interceptPdf } = await chrome.storage.sync.get({ interceptPdf: true });
  return interceptPdf;
}

/**
 * (Ré)installe la règle de redirection des navigations http(s) vers *.pdf.
 *
 * Règle DYNAMIQUE et non statique : l'URL de substitution doit être absolue et
 * l'ID d'extension n'est connu qu'à l'exécution. Aucune boucle possible : la
 * règle ne vise que les navigations main_frame http(s) — la page viewer est en
 * chrome-extension:// et récupère les octets via fetch (type xmlhttprequest).
 *
 * DNR ne peut pas encoder l'URL capturée (\0) : le viewer lit le paramètre
 * `file` en brut (tout ce qui suit « file= »), jamais via URLSearchParams.
 */
async function syncInterception() {
  const enabled = await isInterceptionEnabled();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE_ID],
    addRules: enabled
      ? [
          {
            id: REDIRECT_RULE_ID,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: { regexSubstitution: `${viewerUrl()}?file=\\0` },
            },
            condition: {
              regexFilter: '^https?://[^?#]*\\.pdf([?#].*)?$',
              isUrlFilterCaseSensitive: false,
              resourceTypes: ['main_frame'],
            },
          },
        ]
      : [],
  });
}

// --- PDF locaux (file://) ---------------------------------------------------
// DNR ne s'applique pas au schéma file: ; on bascule l'onglet vers le viewer.
// Nécessite « Autoriser l'accès aux URL de fichier » (réglage par extension).

function isAllowedFileSchemeAccess() {
  try {
    const p = chrome.extension?.isAllowedFileSchemeAccess?.();
    return typeof p?.then === 'function' ? p : Promise.resolve(false);
  } catch {
    return Promise.resolve(false);
  }
}

async function handleFileNavigation(details) {
  if (details.frameId !== 0) return;
  if (!(await isInterceptionEnabled())) return;
  if (!(await isAllowedFileSchemeAccess())) return;
  chrome.tabs.update(details.tabId, { url: viewerUrlFor(details.url) });
}

const FILE_PDF_FILTER = {
  url: [
    { schemes: ['file'], pathSuffix: '.pdf' },
    { schemes: ['file'], pathSuffix: '.PDF' },
  ],
};
chrome.webNavigation.onBeforeNavigate.addListener(handleFileNavigation, FILE_PDF_FILTER);
// Filet de sécurité si onBeforeNavigate est arrivé trop tôt pour être suivi.
chrome.webNavigation.onCommitted.addListener(handleFileNavigation, FILE_PDF_FILTER);

// --- Menus contextuels -------------------------------------------------------

function installContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-link',
      title: "Ouvrir le lien dans l'Éditeur PDF",
      contexts: ['link'],
      targetUrlPatterns: ['*://*/*.pdf*', 'file:///*.pdf*'],
    });
    chrome.contextMenus.create({
      id: 'open-page',
      title: "Ouvrir cette page dans l'Éditeur PDF",
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-link' && info.linkUrl) {
    chrome.tabs.create({ url: viewerUrlFor(info.linkUrl), index: tab ? tab.index + 1 : undefined });
  } else if (info.menuItemId === 'open-page' && tab?.id && tab.url) {
    // Cas des PDF servis sans « .pdf » dans l'URL, affichés par le lecteur natif.
    chrome.tabs.update(tab.id, { url: viewerUrlFor(tab.url) });
  }
});

// --- Clic sur l'icône ---------------------------------------------------------

chrome.action.onClicked.addListener((tab) => {
  const url = tab?.url ?? '';
  const looksLikePdf = /\.pdf([?#]|$)/i.test(url) && /^(https?|file):/i.test(url);
  if (looksLikePdf && tab.id) {
    chrome.tabs.update(tab.id, { url: viewerUrlFor(url) });
  } else {
    chrome.tabs.create({ url: viewerUrl() });
  }
});

// --- Cycle de vie -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  installContextMenus();
  syncInterception();
});
chrome.runtime.onStartup.addListener(syncInterception);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.interceptPdf) syncInterception();
});
