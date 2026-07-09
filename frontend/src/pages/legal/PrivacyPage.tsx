import LegalLayout from "./LegalLayout";

// Politique de confidentialité (RGPD). Content tailored to what DropPulse
// actually collects: account data (email, name), purchase history, and Stripe
// payout identifiers. Placeholders marked .todo must be filled before go-live.

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="8 juillet 2026">
      <p>
        La présente politique décrit comment DropPulse collecte, utilise et
        protège tes données personnelles, conformément au Règlement Général sur
        la Protection des Données (RGPD, Règlement UE 2016/679) et à la loi
        Informatique et Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données est{" "}
        <span className="todo">[À COMPLÉTER : nom / raison sociale de l'éditeur]</span>.
        Pour toute question relative à tes données, tu peux nous contacter à
        l'adresse <span className="todo">[À COMPLÉTER : email de contact RGPD]</span>.
      </p>

      <h2>2. Données que nous collectons</h2>
      <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
      <ul>
        <li><strong>Données de compte</strong> : adresse email, nom d'affichage, mot de passe (stocké chiffré, jamais en clair).</li>
        <li><strong>Historique d'achats</strong> : les exemplaires que tu réserves et achètes, leur numéro de série, date et montant.</li>
        <li><strong>Données de paiement</strong> : gérées et stockées par notre prestataire Stripe. Nous ne conservons jamais tes coordonnées bancaires ; seul un identifiant de compte Stripe est enregistré côté DropPulse.</li>
        <li><strong>Données techniques</strong> : cookies strictement nécessaires (voir la <a href="/cookies">politique cookies</a>).</li>
      </ul>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li><strong>Gestion du compte et des achats</strong> — base légale : exécution du contrat (Art. 6.1.b RGPD).</li>
        <li><strong>Traitement des paiements</strong> — exécution du contrat.</li>
        <li><strong>Notifications par email</strong> (ouverture de drop, confirmation d'achat) — base légale : ton consentement, révocable à tout moment depuis ton profil (Art. 6.1.a).</li>
        <li><strong>Sécurité et prévention de la fraude</strong> — intérêt légitime (Art. 6.1.f).</li>
      </ul>

      <h2>4. Durée de conservation</h2>
      <p>
        Tes données de compte sont conservées tant que ton compte est actif. Si
        tu supprimes ton compte, elles sont effacées. Les données liées aux
        transactions peuvent être conservées le temps requis par les obligations
        légales et comptables{" "}
        <span className="todo">[À COMPLÉTER : durée légale, en général 10 ans pour les pièces comptables]</span>.
      </p>

      <h2>5. Destinataires</h2>
      <p>
        Tes données ne sont ni vendues ni louées. Elles sont partagées uniquement
        avec nos sous-traitants techniques dans la stricte mesure nécessaire :
      </p>
      <ul>
        <li><strong>Stripe</strong> — traitement des paiements et versements.</li>
        <li><strong>Notre prestataire d'envoi d'emails</strong> — envoi des notifications transactionnelles.</li>
        <li><span className="todo">[À COMPLÉTER : hébergeur]</span> — hébergement des données.</li>
      </ul>

      <h2>6. Tes droits</h2>
      <p>Conformément au RGPD, tu disposes des droits suivants :</p>
      <ul>
        <li><strong>Droit d'accès et de portabilité</strong> — tu peux télécharger une copie de tes données au format JSON depuis ton profil.</li>
        <li><strong>Droit de rectification</strong> — corriger tes informations.</li>
        <li><strong>Droit à l'effacement</strong> — supprimer ton compte et tes données depuis ton profil.</li>
        <li><strong>Droit d'opposition</strong> — refuser les emails de notification à tout moment.</li>
      </ul>
      <p>
        Pour exercer ces droits, utilise les outils de ton profil ou contacte-nous.
        Tu peux également introduire une réclamation auprès de la CNIL{" "}
        (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques appropriées : mots de passe
        chiffrés, transport chiffré (HTTPS/TLS), séparation des données bancaires
        (déléguées à Stripe), et contrôle d'accès aux données.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Cette politique peut évoluer. La date de dernière mise à jour figure en
        haut de page.
      </p>
    </LegalLayout>
  );
}
