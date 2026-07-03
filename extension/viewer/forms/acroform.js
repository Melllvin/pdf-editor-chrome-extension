// Formulaires AcroForm : rendu des widgets interactifs par la couche
// d'annotations de pdf.js (les valeurs saisies vivent dans annotationStorage),
// puis collecte {nom, type, valeur} pour l'application pdf-lib à l'export.
import { pdfjsLib } from '../pdf-loader.js';

/**
 * linkService minimal : nous ne naviguons pas dans le document depuis les
 * annotations (et vendoriser web/pdf_viewer.mjs imposerait un import map).
 */
const stubLinkService = {
  eventBus: null,
  externalLinkTarget: 2, // _blank
  externalLinkRel: 'noopener noreferrer nofollow',
  externalLinkEnabled: true,
  getDestinationHash: () => '#',
  getAnchorUrl: () => '#',
  goToDestination: async () => {},
  executeNamedAction: () => {},
  executeSetOCGState: () => {},
  getAttachmentContent: async () => null,
  addLinkAttributes: (link, url) => {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
  },
};

/** Rend les widgets de formulaire d'une page dans view.annotationLayerEl. */
export async function renderAnnotationLayer(view, pdfDocument) {
  const annotations = await view.page.getAnnotations({ intent: 'display' });
  view.annotationLayerEl.replaceChildren();
  if (!annotations.length) return;

  const layer = new pdfjsLib.AnnotationLayer({
    div: view.annotationLayerEl,
    page: view.page,
    viewport: view.viewport.clone({ dontFlip: true }),
    accessibilityManager: null,
    annotationCanvasMap: null,
    annotationEditorUIManager: null,
    structTreeLayer: null,
    commentManager: null,
    linkService: stubLinkService,
    annotationStorage: pdfDocument.annotationStorage,
  });

  await layer.render({
    annotations,
    imageResourcesPath: '',
    renderForms: true,
    downloadManager: null,
    enableScripting: false,
    hasJSActions: false,
    fieldObjects: await pdfDocument.getFieldObjects(),
  });
}

/**
 * Valeurs de formulaire modifiées par l'utilisateur, prêtes pour pdf-lib.
 * annotationStorage est indexé par id d'annotation : on joint via
 * getFieldObjects() (nom qualifié → [{id, type, …}]).
 * @returns {Promise<{name: string, type: string, value: any}[]>}
 */
export async function collectFormValues(pdfDocument) {
  if (!pdfDocument) return [];
  const fieldObjects = await pdfDocument.getFieldObjects();
  if (!fieldObjects) return [];
  const storage = pdfDocument.annotationStorage;
  const values = [];
  for (const [name, objs] of Object.entries(fieldObjects)) {
    for (const obj of objs) {
      const raw = storage.getRawValue(obj.id);
      if (raw?.value === undefined) continue;
      values.push({ name, type: obj.type, value: raw.value });
      break; // une seule valeur par champ (les widgets partagent la valeur)
    }
  }
  return values;
}

/** Des champs ont-ils été modifiés (pour la garde « non enregistré ») ? */
export function hasFormChanges(pdfDocument) {
  return (pdfDocument?.annotationStorage?.size ?? 0) > 0;
}
