import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useCountdown } from "../hooks/useCountdown";
import { getUpcomingDrops, type UpcomingDrop } from "../services/dropsService";
import { apiErrorCode } from "../services/httpClient";

// "Landing — drops à venir" screen. Fetches upcoming drops (GET
// /products/upcoming). The soonest is the hero (big live countdown); the rest
// stack below as compact "à venir après" teasers. Light neobrutalist palette.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Relative day distance for the teaser list ("dans 3 j", "vendredi", …).
function whenLabel(iso: string | null): string {
  if (!iso) return "Bientôt";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} j`;
}

// A countdown cell (Heures / Minutes / Secondes) for the hero.
function CdCell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-[5px] border-2 py-2.5 text-center shadow-[4px_4px_0_#323232] md:py-3.5 ${
        accent ? "border-accent bg-accent" : "border-[#323232] bg-white"
      }`}
    >
      <div
        className={`font-mono text-[34px] font-bold leading-none tabular-nums md:text-[44px] ${
          accent ? "text-white" : "text-[#0F172A]"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-1 text-[10px] font-extrabold tracking-[1.5px] md:mt-1.5 md:text-[11px] md:tracking-[2px] ${
          accent ? "text-[#D1FAE5]" : "text-[#64748B]"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

// Hero block for the soonest drop — big countdown + CTAs.
function Hero({ drop }: { drop: UpcomingDrop }) {
  const navigate = useNavigate();
  const cd = useCountdown(drop.dropAt ? new Date(drop.dropAt).getTime() : Date.now());

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 md:grid md:grid-cols-[1fr_560px] md:items-center md:gap-12">
      {/* Hero photo — real uploaded image when present, else the hachured placeholder. */}
      <div className="order-first h-[230px] overflow-hidden rounded-[5px] border-2 border-[#323232] shadow-[4px_4px_0_#323232] md:order-last md:h-[480px]">
        {drop.imageUrl ? (
          <img
            src={drop.imageUrl}
            alt={`Visuel du drop ${drop.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_10px,#F2F3F4_10px_20px)]">
            <span className="font-mono text-xs text-[#64748B]">photo produit — {drop.name}</span>
          </div>
        )}
      </div>

      {/* Copy + countdown + CTAs */}
      <div className="flex flex-col gap-5 md:gap-6">
        <div className="text-[11px] font-extrabold tracking-[2px] text-accent md:text-[13px] md:tracking-[2.5px]">
          PROCHAIN DROP · {cd.done ? "OUVERT" : whenLabel(drop.dropAt).toUpperCase()}
        </div>
        <h1 className="font-heading text-[34px] font-extrabold leading-[1.05] text-[#0F172A] md:text-[64px] md:leading-[1.02]">
          {drop.name}
        </h1>
        <p className="text-[15px] font-bold leading-normal text-secondary md:text-[19px] md:leading-relaxed">
          {drop.unitCount} unités numérotées. Pas une de plus.
          <br />
          {euros(drop.price)} € · premier arrivé, premier servi.
        </p>

        {/* Countdown */}
        <div
          className="flex gap-2.5 md:max-w-[420px] md:gap-3"
          aria-label="Compte à rebours avant ouverture"
        >
          <CdCell value={cd.hours} label="HEURES" />
          <CdCell value={cd.minutes} label="MINUTES" />
          <CdCell value={cd.seconds} label="SECONDES" accent />
        </div>

        {/* CTAs — "Rejoindre" only becomes active once the countdown reaches zero
            (the drop's dropAt has passed). Before that it's disabled: the drop
            isn't live yet, so joining would land on an empty room. */}
        <div className="flex flex-col gap-2.5 md:flex-row md:gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/drop")}
            disabled={!cd.done}
            className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[17px] font-extrabold tracking-[0.5px] text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:bg-muted disabled:text-[#94A3B8] disabled:shadow-none md:h-[60px] md:px-9 md:text-lg"
          >
            {cd.done ? "Rejoindre le drop" : "Ouvre bientôt"}
          </button>
          <button
            type="button"
            className="h-12 rounded-[5px] border-2 border-[#475569] bg-transparent text-[15px] font-extrabold text-secondary transition-colors hover:border-[#0F172A] hover:text-[#0F172A] md:h-[60px] md:px-7 md:text-base"
          >
            M'alerter à l'ouverture
          </button>
        </div>
      </div>
    </div>
  );
}

// One card in the horizontally-scrolling "à venir après" carousel. Fixed width,
// snaps into place. Image on top, name + price below, a "when" pill overlaid.
function DropTeaser({ drop }: { drop: UpcomingDrop }) {
  return (
    <Link
      to={`/upcoming/${drop.id}`}
      className="flex w-[220px] flex-none snap-start flex-col overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#323232]"
    >
      <div className="relative h-[130px]">
        {drop.imageUrl ? (
          <img
            src={drop.imageUrl}
            alt={`Visuel du drop ${drop.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]" />
        )}
        <span className="absolute right-2 top-2 rounded-[5px] border-2 border-[#323232] bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#334155] shadow-[2px_2px_0_#323232]">
          {whenLabel(drop.dropAt)}
        </span>
      </div>
      <div className="border-t-2 border-[#323232] p-3">
        <div className="truncate font-heading text-[15px] font-bold text-[#0F172A]">{drop.name}</div>
        <div className="mt-0.5 text-[13px] font-bold tabular-nums text-secondary">
          {euros(drop.price)} € · {drop.unitCount} unités
        </div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const [drops, setDrops] = useState<UpcomingDrop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getUpcomingDrops()
      .then((data) => {
        if (alive) setDrops(data);
      })
      .catch((e) => {
        if (alive) setError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const hero = drops?.[0];
  const rest = drops?.slice(1) ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="upcoming" />

      <div className="flex flex-1 flex-col gap-8 px-5 py-6 md:mx-auto md:w-full md:max-w-[1440px] md:px-16 md:py-14">
        {/* Error */}
        {error && (
          <div className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">Impossible de charger les drops.</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
          </div>
        )}

        {/* Loading */}
        {!drops && !error && (
          <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-[1fr_560px]">
            <div className="h-[280px] animate-pulse rounded-[5px] border-2 border-border bg-white md:order-last md:h-[480px]" />
            <div className="h-[280px] animate-pulse rounded-[5px] border-2 border-border bg-white" />
          </div>
        )}

        {/* Empty */}
        {drops && drops.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-heading text-[28px] font-extrabold text-[#0F172A]">
              Aucun drop à venir.
            </h2>
            <p className="text-sm font-bold text-secondary">Reviens bientôt — ça arrive vite.</p>
          </div>
        )}

        {/* Hero + list */}
        {hero && <Hero drop={hero} />}
        {rest.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-extrabold tracking-[2px] text-[#64748B]">
                À VENIR APRÈS
              </div>
              <div className="text-[11px] font-bold tabular-nums text-[#94A3B8]">
                {rest.length} drop{rest.length > 1 ? "s" : ""} · fais défiler →
              </div>
            </div>
            {/* Horizontal snap carousel — one row, scrolls sideways, so 3 or 20
                upcoming drops share the same footprint. */}
            <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
              {rest.map((d) => (
                <DropTeaser key={d.id} drop={d} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
