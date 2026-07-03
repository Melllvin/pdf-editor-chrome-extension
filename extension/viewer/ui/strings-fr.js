// Toutes les chaînes de l'interface, centralisées.
export const STR = {
  appName: 'Éditeur PDF',
  documentDefault: 'document.pdf',
  loading: 'Chargement du document…',
  saving: 'Préparation du PDF…',

  tools: {
    select: 'Sélection',
    text: 'Texte',
    dots: 'Pointillés',
    check: 'Cocher',
    highlight: 'Surligner',
    whiteout: 'Blanco',
  },

  password: {
    title: 'Document protégé',
    prompt: 'Ce PDF est protégé. Saisissez le mot de passe pour l’ouvrir :',
    retry: 'Mot de passe incorrect. Réessayez :',
    ok: 'Ouvrir',
    cancel: 'Annuler',
  },

  errors: {
    http: (status) => `Impossible de charger ce PDF (erreur HTTP ${status}).`,
    network: 'Impossible de charger ce PDF (erreur réseau). Vérifiez votre connexion.',
    fileAccess:
      'Impossible de lire ce fichier local. Activez « Autoriser l’accès aux URL de fichier » ' +
      'dans les détails de l’extension (chrome://extensions), ou ouvrez le fichier via le bouton ci-dessous.',
    invalid: 'Ce fichier ne semble pas être un PDF valide.',
    passwordCanceled: 'Ouverture annulée : ce PDF nécessite un mot de passe.',
    badScheme: 'Cette adresse ne peut pas être ouverte par l’éditeur.',
    generic: 'Une erreur est survenue lors du chargement du document.',
  },

  banners: {
    xfa: 'Ce document contient un formulaire XFA : l’affichage est possible, mais pas l’édition du formulaire.',
    encryptedSave:
      'Ce PDF est protégé : l’enregistrement des modifications n’est pas garanti.',
    chooseFile: 'Choisir un fichier',
    dismiss: 'Fermer',
  },

  toasts: {
    charReplaced: 'Certains caractères non pris en charge ont été remplacés par « ? ».',
    noDots: 'Aucune ligne pointillée détectée — utilisez l’outil Texte avec fond blanc.',
    saved: 'PDF enregistré.',
  },

  confirmLeave: 'Des modifications ne sont pas enregistrées.',
};
