import { Link } from "react-router-dom";
import type { ReactNode } from "react";

// Shared shell for the static legal pages (privacy, terms, legal notice,
// cookies). Public, no auth. Simple readable long-form layout in the app's
// light palette, capped line length for legibility. Cross-links at the bottom.

const LEGAL_LINKS = [
  { to: "/confidentialite", label: "Politique de confidentialité" },
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/cgu", label: "Conditions générales" },
  { to: "/cookies", label: "Cookies" },
];

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b-2 border-[#323232] bg-white px-5 md:h-16 md:px-12">
        <Link to="/" className="font-heading text-lg font-extrabold text-[#0F172A] md:text-xl">
          DropPulse
        </Link>
        <Link to="/" className="text-[13px] font-semibold text-[#64748B] transition-colors hover:text-[#0F172A]">
          ← Retour à l'accueil
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-5 py-10 md:px-8 md:py-16">
        <h1 className="font-heading text-[32px] font-extrabold leading-tight text-[#0F172A] md:text-[42px]">
          {title}
        </h1>
        <p className="mt-2 text-[13px] font-semibold text-secondary">
          Dernière mise à jour : {updated}
        </p>

        <div className="legal-prose mt-8">{children}</div>

        {/* Cross-links */}
        <nav className="mt-14 border-t-2 border-border pt-6">
          <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
            Autres pages légales
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-[14px] font-bold text-accent hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <footer className="border-t-2 border-[#323232] bg-white">
        <div className="mx-auto w-full max-w-[760px] px-5 py-8 text-center md:px-8">
          <span className="text-[12px] font-semibold text-secondary">
            DropPulse — Séries limitées, numérotées, premier arrivé premier servi.
          </span>
        </div>
      </footer>
    </div>
  );
}
