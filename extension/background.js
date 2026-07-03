// Service worker (MV3). Version minimale pour le jalon M2 — l'interception DNR,
// la gestion des file:// et les menus contextuels arrivent au jalon M4.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Éditeur PDF installé.');
});
