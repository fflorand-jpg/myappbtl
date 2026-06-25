export interface ProcedureStep {
  num: number;
  title: string;
  description: string;
}

export interface ContainerTypeImage {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface SupplyItem {
  id: string;
  name: string;
  imageUrl?: string;
  observation?: string;
}

export interface MachineProcedure {
  id: string;
  name: string;
  code: string;
  icon: string;
  description: string;
  mainSteps: ProcedureStep[];
  troubleshooting: {
    issue: string;
    solution: string;
  }[];
  imageUrl?: string;
  containerImages?: ContainerTypeImage[];
  supplies?: SupplyItem[];
  color?: string;
}

export const PACKAGING_MACHINES: MachineProcedure[] = [
  {
    id: 'souffleuse',
    name: 'Souffleuse SBO (0,50 cL)',
    code: 'SBO-101',
    icon: 'Wind',
    description: 'Transforme les préformes en plastique PET de 23g en bouteilles de format 50 cL par étirage-soufflage mécanique et thermique à haute pression.',
    imageUrl: '/src/assets/images/souffleuse_sbo_1780907768240.png',
    mainSteps: [
      {
        num: 1,
        title: 'Vérifier la recette active',
        description: 'Sélectionner et valider la recette de production sur l\'IHM SBO :\n• Type : 500 Cooper 23gr R-co-Resinex\n• Cadence de consigne : 22 000 bouteilles / heure.'
      },
      {
        num: 2,
        title: 'Batterie de tests préformes (Mise en place)',
        description: '• Remettre à zéro tous les compteurs de rejeteur de bouteilles.\n• Préparer physiquement une "Batterie Test" sur les préformes témoins en y introduisant volontairement quatre types d\'anomalies :\n  - Une coupure nette sur le buvant\n  - Une coupure sur la collerette\n  - Une coupure sur le fond de préforme\n  - Un trait de marquage vertical au stylo noir sur le côté de la préforme.'
      },
      {
        num: 3,
        title: 'Ouverture d\'entrée & purge',
        description: '• Ouvrir la trappe pneumatique d\'entrée des préformes dans les fours de chauffe SBO.\n• Laisser le rejet automatique éjecter les bouteilles tests correspondantes.\n• Refermer aussitôt l\'entrée d\'alimentation après le passage d\'une dizaine de préformes afin de sécuriser l\'alignement thermique.'
      }
    ],
    troubleshooting: [
      { issue: 'Non-éjection des préformes défectueuses', solution: 'Vérifier les capteurs photoélectriques de détection de la batterie test et recalibrer le volet éjecteur pneumatique.' },
      { issue: 'Bouteilles froissées ou blanchies', solution: 'Vérifier le profil de chauffe des lampes de four n°3 et n°4 (sur-chauffe ou sous-étirage).' },
      { issue: 'Fond de bouteille non formé', solution: 'Contrôler la pression du soufflage à 40 bars et s\'assurer de l\'efficacité du circuit de refroidissement des moules SBO.' }
    ],
    supplies: [
      { id: 'souf_pref', name: 'Préformes PET 23g', observation: 'Vérifier l\'absence d\'humidité et la conformité du lot de résine.' },
      { id: 'souf_oil', name: 'Lubrifiant Haute Pression', observation: 'Niveau d\'huile du compresseur 40 bars à maintenir stable.' }
    ]
  },
  {
    id: 'remplisseuse',
    name: 'Remplisseuse / Boucheuse',
    code: 'REMP-202',
    icon: 'Droplet',
    description: 'Remplissage gravitaire ou sous pression légère de l\'eau de source et capsulage étanche immédiat.',
    containerImages: [
      { id: 'verre_33cl', label: 'Verre 33cl', imageUrl: '/src/assets/images/verre_33cl_filler_1780909236897.png' },
      { id: 'verre_75cl', label: 'Verre 75cl', imageUrl: '/src/assets/images/verre_75cl_filler_1780909253020.png' },
      { id: 'canette_33cl', label: 'CANETTES 33cl', imageUrl: '/src/assets/images/canette_33cl_filler_1780909270874.png' },
      { id: 'pet_50cl', label: 'PET 50cl', imageUrl: '/src/assets/images/pet_50cl_filler_1780909290777.png' }
    ],
    mainSteps: [],
    troubleshooting: [
      { issue: 'Sous-remplissage persistant', solution: 'Vérifier la membrane d\'évent du bec concerné ou ré-ajuster la temporisation de fermeture pneumatique.' },
      { issue: 'Bouchon de travers', solution: 'Nettoyer le cône de pré-vissage et s\'assurer de l\'intensité du flux pneumatique d\'acheminement.' }
    ],
    supplies: [
      { id: 'remp_bouch', name: 'Bouchons couronne / capsules', observation: 'Alimentation automatique de la trémie supérieure.' },
      { id: 'remp_co2', name: 'CO2 de contre-pression', observation: 'Maintenir la pression de saturation à 1.5 bar.' }
    ]
  },
  {
    id: 'etiqueteuse',
    name: 'Étiqueteuse',
    code: 'ETIQ-303',
    icon: 'Tag',
    description: 'Applique avec précision l\'étiquette de la marque avec de la colle chaude ou sur rouleau auto-adhésif.',
    mainSteps: [],
    troubleshooting: [
      { issue: 'Plis sur l\'étiquette', solution: 'Ajuster la tension du frein de bobine ou resserrer les brosses d\'application en sortie de carrousel.' },
      { issue: 'Découpe décalée du motif', solution: 'Nettoyer la cellule photoélectrique de détection de spot de repère.' }
    ],
    supplies: [
      { id: 'etiq_bob', name: 'Bobines d\'étiquettes', observation: 'Assurer une tension constante sans à-coups sur le bras tendeur.' },
      { id: 'etiq_colle', name: 'Galets de colle chaude', observation: 'Alimenter le fondoir thermique en granulat régulièrement.' }
    ]
  },
  {
    id: 'varioline',
    name: 'La Varioline (Encaisseuse)',
    code: 'VAR-404',
    icon: 'Package',
    description: 'Machine de conditionnement robotisée permettant de regrouper les bouteilles et de les mettre avec précision directement dans des cartons d\'expédition.',
    containerImages: [
      { id: 'var_img1', label: 'Photo 1' },
      { id: 'var_img2', label: 'Photo 2' },
      { id: 'var_img3', label: 'Photo 3' },
      { id: 'var_img4', label: 'Photo 4' },
      { id: 'var_img5', label: 'Photo 5' },
      { id: 'var_img6', label: 'Photo 6' }
    ],
    mainSteps: [],
    troubleshooting: [
      { issue: 'Non-prise d\'une bouteille par la tête d\'encavage', solution: 'Contrôler l\'aspiration ou le vide pneumatique des tulipes de préhension et nettoyer les ventouses.' },
      { issue: 'Bourrage de carton plat au formage', solution: 'Vérifier l\'équerrage des plaques de carton dans le magasin d\'approvisionnement et dépoussiérer les ventouses de prise.' }
    ],
    supplies: [
      { id: 'var_carton', name: 'Flans de carton pliables', observation: 'Régler précisément les butées de prise par dépression ventouse.' },
      { id: 'var_collead', name: 'Adhésif ou Colle à carton', observation: 'Contrôler la température de pose et la buse d\'éjection.' }
    ]
  },
  {
    id: 'palettiseur',
    name: 'Palettiseur automatique',
    code: 'PALE-505',
    icon: 'Layers',
    description: 'Organise les packs empilés en lits successifs sur des palettes de bois normalisées et applique la housse de protection.',
    mainSteps: [
      {
        num: 1,
        title: 'Approvisionnement palettes vides',
        description: 'Charger les palettes Europe vides dans le distributeur automatique arrière de la machine.'
      },
      {
        num: 2,
        title: 'Positionnement du pousseur de lits',
        description: 'Vérifier le gabarit de guidage latéral plastique selon le format de pack programmé.'
      },
      {
        num: 3,
        title: 'Mise à niveau de l\'intercalaire carton',
        description: 'Placer les rouleaux ou plaques de carton de séparation de niveau dans leur chargeur d\'aspiration.'
      }
    ],
    troubleshooting: [
      { issue: 'Glissement d\'un carton intercalaire', solution: 'Vérifier l\'aspiration des ventouses de prise de carton et éliminer la poussière accumulée.' },
      { issue: 'Arrêt d\'urgence sur barrière de cellules', solution: 'S\'assurer qu\'aucun pack ne dépasse latéralement du gabarit de formation de lit.' }
    ],
    supplies: [
      { id: 'pal_bois', name: 'Palettes Europe en bois', observation: 'Vérifier l\'équerrage général et l\'absence d\'humidité excessive.' },
      { id: 'pal_film', name: 'Bobine de film étirable', observation: 'Ajuster la force de pré-étirage du chariot d\'enrubannage.' }
    ]
  }
];
