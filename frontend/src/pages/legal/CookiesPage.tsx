import LegalLayout from "./LegalLayout";

// Politique cookies. DropPulse only uses strictly-necessary local storage
// (auth tokens + a UI preference flag) — no analytics, ads, or third-party
// trackers — so no consent banner is legally required, only this transparency
// notice. Keys listed match the actual storage services.

export default function CookiesPage() {
  return (
    <LegalLayout title="Politique cookies" updated="8 juillet 2026">
      <p>
        DropPulse n'utilise <strong>que des traceurs strictement nécessaires</strong>{" "}
        au fonctionnement du service. Nous n'utilisons aucun cookie publicitaire,
        de mesure d'audience tierce, ou de suivi comportemental. Conformément aux
        recommandations de la CNIL, ces traceurs essentiels ne nécessitent pas ton
        consentement préalable ; cette page t'informe en toute transparence.
      </p>

      <h2>Traceurs utilisés</h2>
      <p>Ils sont stockés localement dans ton navigateur (localStorage), pas envoyés à des tiers :</p>
      <ul>
        <li><strong>flashdrop.access</strong> — jeton d'authentification, te garde connecté pendant ta session.</li>
        <li><strong>flashdrop.refresh</strong> — jeton de rafraîchissement, évite de te reconnecter à chaque visite.</li>
        <li><strong>flashdrop.introSeen</strong> — mémorise que tu as déjà vu l'écran d'introduction, pour ne pas le rejouer.</li>
      </ul>

      <h2>Finalité</h2>
      <p>
        Ces traceurs servent uniquement à te connecter et à mémoriser tes
        préférences d'affichage. Sans eux, tu ne pourrais pas rester authentifié.
      </p>

      <h2>Suppression</h2>
      <p>
        Tu peux effacer ces données à tout moment en te déconnectant, ou en vidant
        le stockage local de ton navigateur via ses paramètres. Les supprimer te
        déconnectera simplement.
      </p>

      <h2>Paiements</h2>
      <p>
        Le paiement est traité par Stripe, qui peut déposer ses propres cookies de
        sécurité lors du paiement. Voir la politique de Stripe pour plus de détails.
      </p>
    </LegalLayout>
  );
}
