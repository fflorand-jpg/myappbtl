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
  description?: string;
}

export interface MachineProcedure {
  id: string;
  name: string;
  code: string;
  icon: string;
  description: string;
  mainSteps: ProcedureStep[];
  containerSteps?: { [containerId: string]: ProcedureStep[] };
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
      { id: 'verre_33cl_plat', label: '33cl Verre Plat', imageUrl: '/src/assets/images/verre_33cl_filler_1780909236897.png' },
      { id: 'verre_33cl_sparkling', label: '33cl Verre Sparkling', imageUrl: '/src/assets/images/verre_33cl_filler_1780909236897.png' },
      { id: 'verre_75cl_plat', label: '75cl Verre Plat', imageUrl: '/src/assets/images/verre_75cl_filler_1780909253020.png' },
      { id: 'verre_75cl_sparkling', label: '75cl Verre Sparkling', imageUrl: '/src/assets/images/verre_75cl_filler_1780909253020.png' },
      { id: 'pet_50cl', label: '50cl PET', imageUrl: '/src/assets/images/pet_50cl_filler_1780909290777.png' },
      { id: 'canette_plat', label: 'Canettes Plat', imageUrl: '/src/assets/images/canette_33cl_filler_1780909270874.png' },
      { id: 'canette_sparkling', label: 'Canettes Sparkling', imageUrl: '/src/assets/images/canette_33cl_filler_1780909270874.png' }
    ],
    mainSteps: [
      {
        num: 1,
        title: 'Vérification et choix du format',
        description: 'Sélectionner la recette de production correspondante (ex: Verre Plat, Sparkling, PET ou Canette) sur l\'IHM de la remplisseuse et ajuster les outillages physiques (étoiles de transfert, guides de col, vis d\'Archimède).'
      },
      {
        num: 2,
        title: 'Stérilisation / Rinçage des contenants',
        description: 'Activer la rinceuse en amont. S\'assurer de la bonne pression d\'eau stérile et d\'air de soufflage pour éliminer toute impureté avant l\'entrée en zone de remplissage.'
      },
      {
        num: 3,
        title: 'Contre-pression et niveau de remplissage',
        description: '• Pour les formats Gazeux (Sparkling/CO2) : ajuster la pression de saturation CO2 (1.5 - 2.0 bar) pour éviter le moussage.\n• Pour les formats Plats : régler la gravité ou le vide léger de retour de manière à obtenir un niveau constant de remplissage.'
      },
      {
        num: 4,
        title: 'Alimentation en bouchons / capsules / couvercles',
        description: 'Vérifier la trémie supérieure et le couloir d\'acheminement :\n• Capsules couronne ou vis pour le Verre.\n• Bouchons plastique à vis pour le PET.\n• Couvercles aluminium de sertissage pour les Canettes.\nS\'assurer du bon tarage de pression de la tête de capsulage ou sertissage.'
      },
      {
        num: 5,
        title: 'Lancement de production et contrôle d\'étanchéité',
        description: 'Démarrer la remplisseuse à cadence minimale. Prélever les premières bouteilles finies pour valider :\n• Le couple de vissage / sertissage correct.\n• La conformité du niveau de remplissage.\n• L\'absence totale de fuites ou de micro-fissures (surtout sur le verre).'
      }
    ],
    containerSteps: {
      'verre_33cl_plat': [
        {
          num: 1,
          title: 'Sélection de la recette 33cl Verre Plat',
          description: 'Activer la recette "33cl Verre Plat" sur l\'IHM. Monter les étoiles de transfert de petit diamètre adaptées au verre 33cl.'
        },
        {
          num: 2,
          title: 'Calage en hauteur',
          description: 'Régler la hauteur du carrousel de rinçage et du bloc de remplissage pour des bouteilles de 220 mm.'
        },
        {
          num: 3,
          title: 'Remplissage gravitaire doux',
          description: 'Ajuster les canules de tirage gravitaire neutre (sans surpression de CO2). Régler le niveau de vide de retour pour éviter les turbulences.'
        },
        {
          num: 4,
          title: 'Bouchage capsule couronne 26mm',
          description: 'Alimenter la trémie supérieure en capsules couronne de 26 mm acier verni. Ajuster l\'effort d\'écrasement de la tête de sertissage.'
        },
        {
          num: 5,
          title: 'Contrôles de démarrage',
          description: 'Démarrer à 12 000 col/heure. Vérifier la régularité du niveau de remplissage sous le goulot (45 mm).'
        }
      ],
      'verre_33cl_sparkling': [
        {
          num: 1,
          title: 'Sélection de la recette 33cl Verre Sparkling',
          description: 'Activer la recette "33cl Gazeux" sur l\'IHM. Vérifier la présence des outillages de guidage renforcés.'
        },
        {
          num: 2,
          title: 'Refroidissement & Pression CO2',
          description: 'Vérifier que la température du liquide est inférieure à 4°C et que la pression de contre-pression CO2 est réglée à 2.2 bar.'
        },
        {
          num: 3,
          title: 'Remplissage isobarométrique',
          description: 'Mettre la bouteille sous pression de CO2 avant ouverture du clapet de liquide. Surveiller le canal de décompression progressive pour éviter le gerbage (moussage).'
        },
        {
          num: 4,
          title: 'Capsulage étanche gaz',
          description: 'Alimenter en capsules couronne 26 mm renforcées spéciales boissons gazeuses. Contrôler le parfait profil d\'assise de la capsule.'
        },
        {
          num: 5,
          title: 'Mesure de saturation',
          description: 'Démarrer à 10 000 col/heure. Prélever une bouteille pour analyser le taux de CO2 dissous (carbo-test).'
        }
      ],
      'verre_75cl_plat': [
        {
          num: 1,
          title: 'Changement d\'outillage 75cl',
          description: 'Installer les guides de corps, les vis d\'alimentation d\'entrée et les étoiles de sortie spécifiques au format verre 75cl lourd.'
        },
        {
          num: 2,
          title: 'Hauteur de carrousel',
          description: 'Rehausser le bloc complet de rinçage, de remplissage et de bouchage pour s\'adapter aux bouteilles de 290 mm.'
        },
        {
          num: 3,
          title: 'Débit de remplissage gravitaire',
          description: 'Régler la temporisation d\'ouverture des becs et les canules de niveau pour un remplissage gravitaire optimal à hauteur de 750 ml.'
        },
        {
          num: 4,
          title: 'Capsulage ou Vissage 28mm',
          description: 'Charger les capsules adaptées (couronne de 29 mm ou capsules à vis 28 mm aluminium). Ajuster le couple d\'étanchéité de la tête.'
        },
        {
          num: 5,
          title: 'Contrôle optique et cadence',
          description: 'Lancer la production à 8 000 col/heure. Valider la hauteur du ménisque liquide et la planéité du capsulage.'
        }
      ],
      'verre_75cl_sparkling': [
        {
          num: 1,
          title: 'Sélection recette 75cl Gazeux',
          description: 'Sélectionner la recette "75cl Verre Sparkling" sur l\'IHM. S\'assurer que les protections de sécurité anti-éclatement physique sont bien actives.'
        },
        {
          num: 2,
          title: 'Pressurisation à 2.5 bar',
          description: 'Ajuster la contre-pression de la cuve tampon à 2.5 bar. Régler le vide préalable de rinceuse pour chasser l\'air ambiant.'
        },
        {
          num: 3,
          title: 'Remplissage isobare lent',
          description: 'Régler la phase de décompression de fin de cycle sur un profil très progressif pour éviter les micro-chocs thermiques et le moussage.'
        },
        {
          num: 4,
          title: 'Capsulage de sécurité renforcé',
          description: 'Utiliser des capsules de 29 mm haute résistance ou muselets de sécurité. Contrôler l\'effort d\'enfoncement hydraulique.'
        },
        {
          num: 5,
          title: 'Cadence de sécurité',
          description: 'Lancer à 7 000 col/heure maximum. Procéder à des inspections visuelles régulières sous la hotte de protection.'
        }
      ],
      'pet_50cl': [
        {
          num: 1,
          title: 'Recette 50cl PET & Neck-handling',
          description: 'Activer la recette "50cl PET" sur l\'IHM. Ajuster les guides de col suspendus (neck-handling), typiques de la manutention PET.'
        },
        {
          num: 2,
          title: 'Rinçage à l\'eau stérile de source',
          description: 'Ajuster la rinceuse rotative. S\'assurer que la pression des buses ne déforme pas le corps léger de la bouteille.'
        },
        {
          num: 3,
          title: 'Remplissage sous pression stabilisée',
          description: 'Remplir avec une pression calibrée pour maintenir la forme de la bouteille souple de 50 cl (paroi fine de 23g).'
        },
        {
          num: 4,
          title: 'Bouchage à vis plastique',
          description: 'Alimenter le trieur en bouchons plastique à vis de 28/410. Régler le couple de la tête de vissage magnétique à 1.8 Nm max.'
        },
        {
          num: 5,
          title: 'Démarrage haute cadence',
          description: 'Lancer la production à 15 000 bouteilles/heure. Tester l\'étanchéité par pression latérale du corps de bouteille.'
        }
      ],
      'canette_plat': [
        {
          num: 1,
          title: 'Recette Canettes & Guides de bande',
          description: 'Activer la recette "Canettes Plat" sur l\'IHM. Installer la table de glissement et les barrières latérales de diamètre canette.'
        },
        {
          num: 2,
          title: 'Rinçage par inversion et soufflage azote',
          description: 'Activer le rinceur par retournement. Injecter un jet d\'air stérile puis d\'azote pour chasser l\'oxygène résiduel.'
        },
        {
          num: 3,
          title: 'Remplissage par le fond',
          description: 'Descendre les canules de remplissage jusqu\'au fond de la canette. Remplir avec un débit progressif sans moussage.'
        },
        {
          num: 4,
          title: 'Injection d\'azote liquide et Sertissage',
          description: 'Injecter une micro-goutte d\'azote liquide juste avant le couvercle pour pressuriser la canette plate. Alimenter le sertisseur en couvercles alu et sertir (1er et 2e pli).'
        },
        {
          num: 5,
          title: 'Contrôle qualité du serti',
          description: 'Lancer à 18 000 canettes/heure. Vérifier sous projecteur de profil la géométrie du pli de sertissage et l\'absence de fuites.'
        }
      ],
      'canette_sparkling': [
        {
          num: 1,
          title: 'Recette Canettes Gazeux',
          description: 'Activer la recette "Canettes Sparkling". Régler les guides d\'acheminement pour canettes aluminium.'
        },
        {
          num: 2,
          title: 'Nettoyage et saturation CO2',
          description: 'Vérifier l\'inversion de la canette au rinceur. Réaliser un balayage préalable de CO2 pour neutraliser l\'oxygène.'
        },
        {
          num: 3,
          title: 'Remplissage isobare et contre-pression',
          description: 'Appliquer une contre-pression de CO2 à 1.8 bar avant d\'injecter l\'eau gazeuse à basse température (3°C) pour un niveau stable.'
        },
        {
          num: 4,
          title: 'Sertissage rapide immédiat',
          description: 'Poser et sertir instantanément le couvercle alu pour emprisonner le gaz. Ajuster la force d\'écrasement des molettes de sertissage.'
        },
        {
          num: 5,
          title: 'Contrôle de serti et étanchéité',
          description: 'Lancer à 16 000 canettes/heure. Vérifier le taux de CO2 final et réaliser un test de tenue à la pression.'
        }
      ]
    },
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
