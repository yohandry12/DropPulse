import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useToast } from "../components/Toast";
import { useCountdown } from "../hooks/useCountdown";
import { getDrop, type UpcomingDrop } from "../services/dropsService";
import { apiErrorCode } from "../services/httpClient";
import {
  getDropAlert,
  subscribeDropAlert,
  unsubscribeDropAlert,
} from "../services/notificationService";

// Detail page for a single upcoming drop (/upcoming/:id). Fetches GET
// /products/:id and shows hero + live countdown to dropAt + stats + alert CTA.
// Light neobrutalist palette, matching the landing page.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Bientôt";
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A countdown cell (Jours / Heures / Minutes / Secondes).
function CdCell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-[5px] border-2 py-2.5 text-center shadow-[4px_4px_0_#323232] md:py-3.5 ${
        accent ? "border-accent bg-accent" : "border-[#323232] bg-white"
      }`}
    >
      <div
        className={`font-mono text-[28px] font-bold leading-none tabular-nums md:text-[40px] ${
          accent ? "text-white" : "text-[#0F172A]"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-1 text-[9px] font-extrabold tracking-[1.5px] md:mt-1.5 md:text-[11px] md:tracking-[2px] ${
          accent ? "text-[#D1FAE5]" : "text-[#64748B]"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function DetailBody({ drop }: { drop: UpcomingDrop }) {
  const navigate = useNavigate();
  const toast = useToast();
  const cd = useCountdown(drop.dropAt ? new Date(drop.dropAt).getTime() : Date.now());

  // "M'alerter à l'ouverture" subscription state. null = still loading.
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getDropAlert(drop.id)
      .then((s) => alive && setSubscribed(s))
      .catch(() => alive && setSubscribed(false)); // fetch fail → treat as not subscribed
    return () => {
      alive = false;
    };
  }, [drop.id]);

  async function toggleAlert() {
    if (alertBusy || subscribed === null) return;
    setAlertBusy(true);
    const next = !subscribed;
    setSubscribed(next); // optimistic
    try {
      if (next) await subscribeDropAlert(drop.id);
      else await unsubscribeDropAlert(drop.id);
      toast.success(next ? "Tu seras alerté à l'ouverture." : "Alerte désactivée.");
    } catch {
      setSubscribed(!next); // revert on failure
      toast.error("Échec. Réessaie.");
    } finally {
      setAlertBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-6 md:mx-auto md:w-full md:max-w-[1440px] md:grid md:grid-cols-[1fr_560px] md:items-center md:gap-12 md:px-16 md:py-14">
      {/* Photo — real uploaded image when present, else the hachured placeholder. */}
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

      {/* Copy + countdown + stats */}
      <div className="flex flex-col gap-5 md:gap-6">
        <button
          type="button"
          onClick={() => navigate("/upcoming")}
          className="self-start text-[13px] font-extrabold text-[#64748B] transition-colors hover:text-[#0F172A]"
        >
          ← Retour aux drops
        </button>

        <div className="text-[11px] font-extrabold tracking-[2px] text-accent md:text-[13px] md:tracking-[2.5px]">
          {cd.done ? "OUVERT MAINTENANT" : "DROP À VENIR"}
        </div>
        <h1 className="font-heading text-[34px] font-extrabold leading-[1.05] text-[#0F172A] md:text-[56px] md:leading-[1.02]">
          {drop.name}
        </h1>
        <p className="text-[15px] font-bold leading-normal text-secondary md:text-[19px]">
          {drop.unitCount} unités numérotées. Pas une de plus.
          <br />
          {euros(drop.price)} € · premier arrivé, premier servi.
        </p>
        {drop.description && (
          <p className="text-sm font-semibold text-[#64748B]">{drop.description}</p>
        )}

        {/* Countdown */}
        <div
          className="flex gap-2 md:max-w-[480px] md:gap-3"
          aria-label="Compte à rebours avant ouverture"
        >
          <CdCell value={cd.days} label="JOURS" />
          <CdCell value={cd.hoursOfDay} label="HEURES" />
          <CdCell value={cd.minutes} label="MINUTES" />
          <CdCell value={cd.seconds} label="SECONDES" accent />
        </div>

        <div className="text-[13px] font-bold text-secondary">
          Ouverture : <span className="text-[#0F172A]">{fmtDateTime(drop.dropAt)}</span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2.5 md:flex-row md:gap-3.5">
          {cd.done ? (
            <button
              type="button"
              onClick={() => navigate("/drop")}
              className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[17px] font-extrabold tracking-[0.5px] text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none md:h-[60px] md:px-9 md:text-lg"
            >
              Rejoindre le drop
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleAlert}
              disabled={alertBusy || subscribed === null}
              aria-pressed={subscribed === true}
              className={`h-14 rounded-[5px] border-2 border-[#323232] font-heading text-[17px] font-extrabold tracking-[0.5px] shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60 md:h-[60px] md:px-9 md:text-lg ${
                subscribed ? "bg-white text-[#0F172A]" : "bg-accent text-white"
              }`}
            >
              {subscribed === null
                ? "Chargement…"
                : subscribed
                ? "✓ Alerte activée"
                : "M'alerter à l'ouverture"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<UpcomingDrop | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getDrop(id)
      .then((d) => {
        if (alive) setDrop(d);
      })
      .catch((e) => {
        if (alive) setError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="upcoming" />

      {(error === "product_archived" || error === "product_paused") && (
        // Soft-deleted or paused drop: guide the visitor onward instead of a hard
        // error. Backend returns 410 product_archived / product_paused.
        <div className="flex flex-1 items-center justify-center px-5">
          <div className="max-w-[420px] rounded-[5px] border-2 border-[#323232] bg-white p-7 text-center shadow-[5px_5px_0_#323232]">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#323232] bg-muted text-[#334155]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.91 8.84 8.56 21.19a2.25 2.25 0 0 1-3.18 0l-2.57-2.57a2.25 2.25 0 0 1 0-3.18L15.16 3.09" />
                <path d="m6.13 6.13 11.74 11.74" />
              </svg>
            </span>
            <h1 className="mt-4 font-heading text-[22px] font-extrabold text-[#0F172A]">
              Ce drop a été retiré
            </h1>
            <p className="mt-2 text-[14px] font-semibold leading-snug text-secondary">
              Cette collection n'est plus disponible. De nouveaux drops arrivent — jette un œil à ce qui est en cours.
            </p>
            <button
              type="button"
              onClick={() => navigate("/upcoming")}
              className="mt-5 h-11 rounded-[5px] border-2 border-[#323232] bg-accent px-5 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Découvre les drops en cours →
            </button>
          </div>
        </div>
      )}

      {error && error !== "product_archived" && error !== "product_paused" && (
        <div className="flex flex-1 items-center justify-center px-5">
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-5 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">
              {error === "product_not_found" ? "Ce drop n'existe pas." : "Impossible de charger le drop."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/upcoming")}
              className="mt-3 text-[13px] font-extrabold text-accent"
            >
              ← Retour aux drops
            </button>
          </div>
        </div>
      )}

      {!drop && !error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
        </div>
      )}

      {drop && <DetailBody drop={drop} />}
    </div>
  );
}
