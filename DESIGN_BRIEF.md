# DropPulse — Design Brief

> À coller dans Claude (design) pour générer les écrans. Décrit ce qu'est le produit, qui l'utilise, l'ambiance visuelle et les écrans à concevoir.

---

## Ce qu'est DropPulse

DropPulse est une plateforme e-commerce de **ventes flash à stock limité** — le pattern "drop" de sneakers. Un produit sort à une heure précise, en **quantité très limitée** avec des **unités individuellement numérotées** (ex : paire #001/100). Des centaines d'acheteurs se ruent en même temps sur un stock rare : c'est une course.

Le cœur du produit n'est pas le catalogue, c'est **le moment du drop** : tension, rareté, urgence, "premier arrivé premier servi". Quand un utilisateur clique pour acheter une unité, elle est **réservée temporairement pour lui** (un hold de quelques minutes) le temps de payer ; s'il ne confirme pas, elle repart en stock pour quelqu'un d'autre.

C'est un **projet portfolio** (démonstration technique) — l'accent est mis sur une expérience de drop crédible et léchée, pas sur un vrai back-office marchand.

---

## États d'une unité (central pour l'UI)

Chaque unité numérotée vit dans un de ces états, à refléter visuellement :

- **Disponible** — achetable, c'est la cible
- **Réservée (hold)** — quelqu'un est en train de l'acheter ; compte à rebours ; indisponible pour les autres
- **Vendue** — définitivement partie

L'utilisateur ne peut tenir **qu'une seule réservation à la fois**. L'UI doit rendre lisibles en un coup d'œil : ce qui reste, ce qui est en cours, ce qui est parti, et le temps restant sur sa propre réservation.

---

## Qui l'utilise

- **Acheteurs** grand public, plutôt jeunes, culture sneaker/streetwear/hype
- Contexte : arrivent au moment du drop, souvent sur mobile, sous adrénaline
- Attente : rapidité, clarté immédiate du stock, feedback instantané ("c'est à moi / c'est parti / il reste X")

---

## Ambiance visuelle (déjà amorcée)

Direction déjà posée sur l'écran de connexion, à prolonger :

- **Style :** flat design moderne, épuré, épuré mais avec une **touche hype/urgence**
- **Couleurs :** base ardoise (slate `#334155` / `#475569`), fond clair (`#F8FAFC`), accent **vert "stock" `#059669`** (call-to-action, dispo), rouge `#DC2626` pour rupture/erreur
- **Typo :** Rubik (titres) + Nunito Sans (corps)
- **Signature :** neobrutalism léger sur les contrôles (bordure slate 2px + ombre portée dure `4px 4px`), déjà utilisé sur les boutons/inputs du login
- **Login :** photo de montagne au coucher de soleil en fond + carte flip (connexion/inscription) — décor immersif
- **Bienvenue 1ère connexion :** animation 3D "FlashDrop" (wordmark extrudé, sol qui explose, caméra qui orbite) — établit l'identité de marque

Éviter : décoration excessive, ombres complexes/3D, emojis en guise d'icônes (SVG uniquement).

---

## Écrans à concevoir

1. **Landing / page du drop à venir** — teaser du prochain drop : visuel produit, compte à rebours avant ouverture, "X unités seulement", CTA "Rejoindre le drop". Doit créer l'anticipation.
2. **Page du drop actif (l'écran clé)** — la grille des unités numérotées avec leur état en temps réel (disponible / réservée / vendue), le stock restant, un CTA pour saisir une unité. Tension et lisibilité maximales.
3. **Flux de réservation → paiement** — après avoir saisi une unité : confirmation, **compte à rebours du hold**, bouton payer, états d'erreur clairs (hold expiré, unité déjà partie, pas ta réservation).
4. **Confirmation d'achat** — "L'unité #042 est à toi", numéro de série mis en avant, ton de célébration.
5. **États vides / d'échec** — drop terminé (tout vendu), réservation expirée, rien à acheter.
6. **(déjà fait) Connexion / inscription** — pour cohérence de style.

---

## Contraintes techniques (pour rester réaliste)

- Stack front : **React + TypeScript + Tailwind CSS** (SPA Vite)
- Icônes : **SVG** (Heroicons / Lucide), jamais d'emoji
- Mobile-first (les drops se vivent au téléphone), responsive 375 / 768 / 1024 / 1440
- Accessibilité : contraste AA, focus visibles, `prefers-reduced-motion` respecté
- Le compte à rebours et le stock changent en temps réel — prévoir des états de chargement/rafraîchissement propres (skeletons, pas de layout shift)
- Chiffres (stock, timer, numéros de série) en tabular/monospace pour éviter le tremblement

---

## Ton

Urgent mais maîtrisé. Hype sneaker-drop sans être criard. La rareté et le temps qui défile sont les héros émotionnels ; le design doit faire ressentir "c'est maintenant ou jamais" tout en restant lisible sous stress.
