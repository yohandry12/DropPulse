import LegalLayout from "./LegalLayout";

// Mentions légales — mandatory publisher/host identification for a French site.
// All owner-specific data is placeholdered.

export default function LegalNoticePage() {
  return (
    <LegalLayout title="Mentions légales" updated="8 juillet 2026">
      <h2>Éditeur du site</h2>
      <ul>
        <li><strong>Dénomination</strong> : <span className="todo">[À COMPLÉTER : nom / raison sociale]</span></li>
        <li><strong>Forme juridique</strong> : <span className="todo">[À COMPLÉTER : ex. auto-entrepreneur, SAS…]</span></li>
        <li><strong>Adresse</strong> : <span className="todo">[À COMPLÉTER : adresse du siège]</span></li>
        <li><strong>Email</strong> : <span className="todo">[À COMPLÉTER : email de contact]</span></li>
        <li><strong>SIRET</strong> : <span className="todo">[À COMPLÉTER : numéro SIRET]</span></li>
        <li><strong>Directeur de la publication</strong> : <span className="todo">[À COMPLÉTER : nom]</span></li>
      </ul>

      <h2>Hébergeur</h2>
      <ul>
        <li><strong>Nom</strong> : <span className="todo">[À COMPLÉTER : hébergeur]</span></li>
        <li><strong>Adresse</strong> : <span className="todo">[À COMPLÉTER : adresse de l'hébergeur]</span></li>
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus présents sur DropPulse (textes, visuels, logos,
        code) est protégé par le droit de la propriété intellectuelle. Toute
        reproduction non autorisée est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        L'usage des cookies est détaillé dans la{" "}
        <a href="/cookies">politique cookies</a>.
      </p>
    </LegalLayout>
  );
}
