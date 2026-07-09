import LegalLayout from "./LegalLayout";

// Conditions générales d'utilisation et de vente. Covers the drop/hold/purchase
// mechanics specific to DropPulse plus the mandatory e-commerce clauses
// (pricing, withdrawal right, guarantees). Owner-specific details placeholdered.

export default function TermsPage() {
  return (
    <LegalLayout title="Conditions générales" updated="8 juillet 2026">
      <p>
        Les présentes conditions régissent l'utilisation de DropPulse et les
        ventes réalisées sur la plateforme. En créant un compte, tu les acceptes.
      </p>

      <h2>1. Objet</h2>
      <p>
        DropPulse est une plateforme de ventes en série limitée (« drops »).
        Chaque exemplaire est numéroté et unique. Les drops ouvrent à date fixe ;
        chaque unité est réservable puis achetable premier arrivé, premier servi.
      </p>

      <h2>2. Compte</h2>
      <p>
        L'accès aux achats requiert un compte. Tu es responsable de la
        confidentialité de tes identifiants et de l'exactitude des informations
        fournies. Un compte peut être désactivé en cas d'usage frauduleux.
      </p>

      <h2>3. Réservation et achat</h2>
      <ul>
        <li>Une réservation (« hold ») met une unité de côté pour une durée limitée affichée à l'écran.</li>
        <li>Passé ce délai sans paiement, l'unité repart automatiquement en vente.</li>
        <li>Le paiement confirme l'achat : l'exemplaire t'est alors définitivement attribué.</li>
        <li>Une limite d'exemplaires par acheteur peut s'appliquer à chaque drop.</li>
      </ul>

      <h2>4. Prix et paiement</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises. Le paiement est
        traité de façon sécurisée par Stripe. DropPulse ne stocke aucune donnée
        bancaire.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément au Code de la consommation, le consommateur dispose en
        principe d'un délai de rétractation de 14 jours pour les achats à
        distance.{" "}
        <span className="todo">[À COMPLÉTER : préciser les modalités et exceptions applicables à tes produits, ex. biens personnalisés/numérotés]</span>.
      </p>

      <h2>6. Garanties</h2>
      <p>
        Les produits bénéficient des garanties légales de conformité et contre
        les vices cachés prévues par la loi.
      </p>

      <h2>7. Rôle de vendeur (dropper)</h2>
      <p>
        Les utilisateurs autorisés (« droppers ») peuvent créer des drops. Ils
        sont responsables de la conformité et de l'expédition des articles qu'ils
        mettent en vente, et perçoivent les paiements via Stripe Connect.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        DropPulse s'efforce d'assurer la disponibilité et l'exactitude du service
        mais ne peut être tenu responsable des interruptions techniques ou des
        contenus fournis par les droppers.
      </p>

      <h2>9. Litiges</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de
        litige, une solution amiable sera recherchée avant toute action
        judiciaire.{" "}
        <span className="todo">[À COMPLÉTER : coordonnées du médiateur de la consommation si applicable]</span>.
      </p>
    </LegalLayout>
  );
}
