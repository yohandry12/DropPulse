# DropPulse — Design Brief · Espace Admin & Dropper

> À coller dans Claude (design) pour générer les écrans de back-office. Décrit les rôles, qui fait quoi, l'ambiance visuelle (prolonge le brief public) et chaque écran à concevoir. Complète le `DESIGN_BRIEF.md` public (côté acheteur) — même identité, même palette, même signature neobrutalism.

---

## Contexte — ce qui change

Jusqu'ici DropPulse n'avait qu'un public : l'acheteur qui court après le drop. On introduit **la création de drops** et donc un back-office. Le catalogue n'est plus seedé à la main : des utilisateurs habilités créent les drops eux-mêmes, et un super-utilisateur supervise tout.

Ça fait apparaître **trois rôles** et **trois espaces** distincts, à concevoir avec la même exigence visuelle que le front public.

---

## Les trois rôles

| Rôle | Nom | Ce qu'il peut faire |
|---|---|---|
| **Chaser** | l'acheteur (défaut) | Courir après les drops : acheter une unité numérotée, tenir un hold, payer. C'est le rôle de tout compte à l'inscription. Peut **demander** à devenir Dropper. |
| **Dropper** | le créateur | Tout ce qu'un Chaser fait **+** créer et gérer **ses** drops (programmer, brouillon, suivre les ventes). Ne voit que ses propres drops. |
| **Admin** | le superviseur | Pouvoir ultime. Crée des drops comme un Dropper **+** voit **tous** les utilisateurs (désactiver / réactiver / mettre à jour / supprimer définitivement), **tous** les drops (mettre à jour / supprimer), et **valide** les demandes de passage Dropper. |

**Le rôle est une capacité surajoutée, pas exclusive** : un Dropper reste un acheteur, un Admin reste un Dropper+acheteur. L'UI n'enferme jamais — elle **révèle** des espaces supplémentaires selon le rôle.

Le tout premier Admin est créé côté base (seed), pas via l'interface — personne ne peut s'auto-nommer Admin.

---

## Devenir Dropper — le parcours d'habilitation (central)

Un Chaser ne devient pas Dropper tout seul. Le parcours, à rendre lisible et rassurant :

```
1. Le Chaser ouvre "Devenir dropper" → soumet une demande (un mot sur son projet).
   État de sa demande : EN ATTENTE.
2. L'Admin voit la demande dans sa file → l'approuve.
   Le système génère un CODE DE VALIDATION à usage unique.
3. Le code est transmis de DEUX façons, en parallèle :
   - à l'Admin, affiché à l'écran (il peut le communiquer hors-app si besoin) ;
   - au demandeur, in-app : à sa prochaine visite de "Devenir dropper", il voit
     « Demande approuvée — voici ton code ».
4. Le demandeur saisit le code dans son espace → il devient Dropper.
   L'espace de création de drops s'ouvre pour lui.
```

Les états à refléter visuellement côté demandeur : **aucune demande** (invitation à candidater), **en attente** (patience, rien à faire), **approuvée / code à saisir** (action attendue), **déjà Dropper** (l'espace création est débloqué).

Côté Admin : la file de demandes distingue **en attente** (à traiter) de **approuvées** (code déjà émis, en attente de saisie par le demandeur).

---

## Ambiance visuelle — prolonge l'identité, mais registre "outil"

Même ADN que le front public (voir `DESIGN_BRIEF.md`), avec une nuance de registre : le public est **hype/urgence** ; le back-office est **calme, dense, maîtrisé**. On ne court pas dans un back-office, on pilote.

- **Style :** flat moderne, épuré, neobrutalism léger conservé sur les contrôles (bordure slate 2px `#323232` + ombre portée dure `4px 4px`, radius ~5px). Signature identique aux boutons/inputs du login.
- **Couleurs :** identiques — base ardoise (`#334155` / `#475569`), fond clair (`#F8FAFC`), accent vert "stock/valider" (`#059669`), rouge (`#DC2626`) pour destructif/désactiver/supprimer. Le rouge prend ici un rôle fonctionnel fort (actions dangereuses admin) — toujours accompagné d'un libellé, jamais couleur seule.
- **Typo :** Rubik (titres) + Nunito Sans (corps). Chiffres (stock, recette, compteurs, codes) en **tabular/monospace**.
- **Densité :** le back-office assume plus de données à l'écran que le public — tables, statuts, compteurs. Hiérarchie par taille/espacement/contraste, pas par couleur seule. Aération intentionnelle : grouper, séparer les sections, éviter le mur de données.
- **Badges de rôle & statut :** petites pastilles bordées (neobrutalism) — rôle (`CHASER` / `DROPPER` / `ADMIN`), statut user (`ACTIF` / `DÉSACTIVÉ`), statut drop (`BROUILLON` / `PROGRAMMÉ` / `LIVE` / `ÉPUISÉ`), statut demande (`EN ATTENTE` / `APPROUVÉE`). Couleur sémantique + libellé texte, jamais l'un sans l'autre.

Éviter : décoration excessive, ombres 3D, emojis en guise d'icônes (SVG Heroicons/Lucide uniquement), tables illisibles sur mobile (repli en cartes empilées).

---

## Écrans à concevoir

### Espace Dropper (créer & gérer ses drops)

**D1 · Créer un drop** — l'écran phare (form déjà maquetté, à respecter). Formulaire en trois sections, avec **aperçu de la landing en direct à droite** qui se met à jour pendant la saisie (miroir de ce que verra l'acheteur) :
- **01 · Produit** : visuel produit (glisser une image ou parcourir — upload réel), nom du modèle, édition / coloris, description (optionnel, 2 lignes max).
- **02 · Stock & prix** : prix unitaire, nombre d'unités, limite par acheteur. Un rappel indique la plage d'unités qui sera générée (`#001 → #100`, chacune numérotée).
- **03 · Ouverture & réservation** : date d'ouverture, heure d'ouverture, durée du hold (choix 5 / 10 / 15 / 20 min — le temps laissé à l'acheteur pour payer avant que l'unité reparte).
- **Actions** : *Programmer le drop* (accent vert), *Enregistrer le brouillon* (secondaire), *Annuler* (discret).
- L'aperçu live montre : visuel, badge « PROCHAIN DROP · #NN · date · heure », nom, édition, « X unités numérotées · prix », compte à rebours, CTA « Rejoindre le drop », et un récap chiffré (plage d'unités, recette max, hold par unité).
- Responsive : sur mobile l'aperçu passe **au-dessus** du formulaire (carte compacte), les sections s'empilent.

**D2 · Mes drops** — liste de tous les drops créés par ce Dropper, chacun avec son **statut** (brouillon / programmé / live / épuisé), la plage d'unités, le prix, la date d'ouverture, et un aperçu du stock écoulé. Tri par date d'ouverture. Un bouton clair « Créer un drop ». État vide : « Aucun drop encore — lance ton premier. »

**D3 · Détail / gérer un drop** — vue d'un drop précis : ses métadonnées, l'état du stock en temps réel (disponible / réservé / vendu), la recette encaissée, le compteur de ventes. Actions selon statut : éditer un brouillon, dépublier, etc. (Un Dropper n'agit que sur **ses** drops.)

### Espace Chaser (habilitation)

**C1 · Devenir dropper** — un seul écran, quatre visages selon l'état de la demande :
- **Aucune demande** : pitch (« Tu veux lancer tes propres drops ? »), un court formulaire de candidature (projet en un mot), bouton *Envoyer ma demande*.
- **En attente** : accusé de réception rassurant (« Demande reçue — un admin va la regarder »), aucune action possible, statut `EN ATTENTE`.
- **Approuvée / code à saisir** : « Bonne nouvelle, ta demande est approuvée. » + champ de saisie du **code de validation** + bouton *Valider*. Erreur claire si code faux/expiré.
- **Déjà Dropper** : confirmation (« Tu es Dropper »), redirection/CTA vers l'espace création.

### Espace Admin (supervision — pouvoir ultime)

**A1 · Dashboard admin** — vue d'ensemble d'entrée : compteurs clés (utilisateurs, drops actifs, demandes en attente à traiter), et raccourcis vers les trois zones de gestion. Met en avant ce qui **demande une action** (demandes en attente).

**A2 · Gestion des utilisateurs** — table de **tous** les comptes : email, rôle (badge), statut (`ACTIF` / `DÉSACTIVÉ`), date d'inscription, nb d'achats. Recherche/filtre par rôle et statut. Actions par ligne, avec confirmation systématique pour tout ce qui est destructif :
- **Désactiver / Réactiver** (bascule le statut — un compte désactivé ne peut plus se connecter).
- **Mettre à jour** (éditer les champs autorisés, y compris promouvoir/rétrograder le rôle).
- **Supprimer définitivement** (rouge, double confirmation — action irréversible).

**A3 · Gestion des drops** — table de **tous** les drops de la plateforme (tous droppers confondus) : nom, créateur, statut, plage d'unités, stock écoulé, date. Filtre par statut/créateur. Actions : mettre à jour, **supprimer** (rouge, confirmation). L'Admin peut aussi créer un drop (réutilise **D1**).

**A4 · Demandes dropper** — la file d'habilitation : liste des demandes avec demandeur, projet, date, statut (`EN ATTENTE` / `APPROUVÉE`). Pour une demande en attente : bouton *Approuver* → l'écran **révèle le code de validation généré** (affiché en clair, monospace, copiable — c'est le canal « Admin »). Les demandes approuvées restent visibles avec leur code, en attente que le demandeur le saisisse.

---

## Navigation & garde-fous

- **La navigation s'adapte au rôle.** Un Chaser ne voit ni « Créer un drop » ni l'espace Admin. Un Dropper voit « Créer un drop » + « Mes drops ». Un Admin voit en plus l'espace de supervision. Rien de caché par simple CSS — l'accès est vérifié côté serveur ; l'UI reflète juste ce à quoi l'utilisateur a droit.
- **Actions destructives** (désactiver, supprimer user/drop) : toujours confirmation explicite, libellé rouge, jamais déclenchables par erreur. Suppression définitive = double confirmation.
- **Feedback** : toute action admin/dropper renvoie un retour immédiat (succès/erreur), état de chargement sur les boutons pendant l'appel réseau. Pas de layout shift.

---

## Contraintes techniques (rester réaliste)

- Stack front : **React + TypeScript + Tailwind CSS** (SPA Vite), cohérent avec le front public.
- Icônes : **SVG** (Heroicons / Lucide), jamais d'emoji.
- **Mobile-first** aussi pour l'admin : les tables se replient en cartes empilées sous 768px, pas de scroll horizontal. Un Dropper doit pouvoir créer un drop depuis son téléphone.
- Responsive 375 / 768 / 1024 / 1440.
- Accessibilité : contraste AA, focus visibles, labels de formulaire visibles (pas placeholder seul), erreurs près du champ, `prefers-reduced-motion` respecté.
- **Upload d'image réel** (visuel produit) : stockage objet compatible S3 (MinIO en local via Docker). L'UI prévoit un état de dépôt (glisser-déposer / parcourir), une prévisualisation, un état d'envoi et une erreur possible.
- Chiffres (stock, recette, compteurs, numéros, codes de validation) en tabular/monospace pour éviter le tremblement.
- États de chargement propres (skeletons) partout où des données arrivent du serveur ; pas de layout shift.

---

## Ton

**Calme, dense, maîtrisé — l'inverse du front public.** Le public vit l'urgence du drop ; le back-office est l'atelier où on prépare cette urgence, sereinement. Clarté avant tout : un Dropper doit comprendre son stock d'un coup d'œil, un Admin doit repérer immédiatement ce qui demande une action. Le pouvoir de l'Admin est réel (il supprime, désactive) — le design le rend **responsabilisant**, jamais anxiogène : chaque action grave est explicite, confirmée, réversible quand c'est possible.
