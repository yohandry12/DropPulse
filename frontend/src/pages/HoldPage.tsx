import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Spinner from "../components/Spinner";
import { useHoldTimer } from "../hooks/useHoldTimer";
import { apiErrorCode } from "../services/httpClient";
import {
  confirmPayment,
  getMyHold,
  releaseHold,
  startCheckout,
  type ActiveHold,
} from "../services/dropService";

// "Réservation → paiement" screen (maquette 1d), wired to the backend.
// Fetches the user's active hold (GET /units/my-hold) so it survives refresh
// and shows the real deadline. States:
//  - active: hold timer counting to the real expiresAt (green, red under 2 min)
//  - expired: timer hit 00:00 / no active hold, unit back on sale
// Light palette + neobrutalist tokens.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

// Product recap card, shared by active + expired (dimmed) views.
function ProductRecap({ hold, dimmed = false }: { hold: ActiveHold; dimmed?: boolean }) {
  return (
    <div
      className={`rounded-[5px] border-2 bg-white p-4 ${
        dimmed ? "border-border opacity-60" : "border-[#323232] shadow-[4px_4px_0_#323232]"
      }`}
    >
      <div
        className={`flex items-center gap-3.5 ${
          dimmed ? "" : "border-b-2 border-dashed border-border pb-3"
        }`}
      >
        <div className="h-14 w-14 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
          {hold.imageUrl ? (
            <img src={hold.imageUrl} alt={`Visuel du drop ${hold.productName}`} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]" />
          )}
        </div>
        <div>
          <div
            className={`font-heading text-base font-bold ${
              dimmed ? "text-[#64748B] line-through" : "text-[#0F172A]"
            }`}
          >
            {hold.productName}
          </div>
          <div className={`text-[13px] font-bold ${dimmed ? "text-[#94A3B8]" : "text-secondary"}`}>
            Unité <span className="font-mono text-accent">{hold.serialNumber}</span>
            <span className="text-[#94A3B8]">{dimmed ? " — plus à toi" : ""}</span>
          </div>
        </div>
      </div>
      {!dimmed && (
        <div className="flex justify-between pt-3 text-[15px] font-extrabold text-[#0F172A]">
          <span>Total</span>
          <span className="tabular-nums">{euros(hold.price)} €</span>
        </div>
      )}
    </div>
  );
}

function ActiveView({ hold, onExpire }: { hold: ActiveHold; onExpire: () => void }) {
  const navigate = useNavigate();
  const t = useHoldTimer(new Date(hold.expiresAt).getTime());
  const color = t.warning ? "#DC2626" : "#059669";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flip to the expired view the moment the timer hits zero (in an effect).
  useEffect(() => {
    if (t.expired) onExpire();
  }, [t.expired, onExpire]);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Stripe Checkout: redirect to the hosted payment page. The held→sold flip
      // is done server-side by the webhook once payment completes.
      const url = await startCheckout(hold.id);
      window.location.assign(url);
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === "payments_not_configured") {
        // Stripe keys absent (dev): fall back to the simulated confirm so the
        // flow is still testable end-to-end without a payment provider.
        try {
          await confirmPayment(hold.id);
          navigate("/confirmation", { state: { serialNumber: hold.serialNumber } });
          return;
        } catch (e2) {
          const c2 = apiErrorCode(e2);
          setError(c2 === "hold_expired" ? "Réservation expirée." : "Le paiement a échoué.");
          if (c2 === "hold_expired") onExpire();
          setBusy(false);
          return;
        }
      }
      setError(code === "hold_expired" ? "Réservation expirée." : "Le paiement a échoué.");
      if (code === "hold_expired") onExpire();
      setBusy(false);
    }
  }

  async function release() {
    if (busy) return;
    setBusy(true);
    try {
      await releaseHold(hold.id);
    } catch {
      // ignore; navigating away anyway
    } finally {
      navigate("/drop");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-5 md:mx-auto md:w-full md:max-w-[480px]">
      <div>
        <div className="text-[11px] font-extrabold tracking-[2px] text-accent">RÉSERVÉE POUR TOI</div>
        <h2 className="mt-1 font-heading text-[26px] font-extrabold text-[#0F172A]">
          Elle t'attend. Paye avant la fin.
        </h2>
      </div>

      {/* Timer card */}
      <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 text-center shadow-[4px_4px_0_#323232]">
        <div className="text-[11px] font-extrabold tracking-[1.5px] text-[#64748B]">TEMPS RESTANT</div>
        <div
          className="font-mono text-[64px] font-bold leading-[1.05] tabular-nums"
          style={{ color }}
          aria-live="polite"
        >
          {t.minutes}:{t.seconds}
        </div>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-[5px] border-2 border-[#323232] bg-muted">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${t.pct}%`, background: color }}
          />
        </div>
        <p className="mt-2.5 text-xs font-semibold text-[#64748B]">
          Passé ce délai, l'unité repart en vente.
        </p>
      </div>

      <ProductRecap hold={hold} />

      {error && (
        <div className="rounded-[5px] border-2 border-destructive bg-white px-3 py-2 text-center text-[13px] font-bold text-destructive">
          {error}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-[17px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Traitement…
            </span>
          ) : (
            `Payer ${euros(hold.price)} € maintenant`
          )}
        </button>
        <button
          type="button"
          onClick={release}
          disabled={busy}
          className="h-11 rounded-[5px] border-2 border-border bg-transparent text-sm font-extrabold text-[#64748B] transition-colors hover:border-[#94A3B8] hover:text-primary disabled:opacity-50"
        >
          Libérer l'unité
        </button>
      </div>
    </div>
  );
}

function ExpiredView() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-5 md:mx-auto md:w-full md:max-w-[480px]">
      <div className="rounded-[5px] border-2 border-destructive bg-white px-4 py-5 text-center shadow-[4px_4px_0_#DC2626]">
        <div className="font-mono text-[56px] font-bold leading-none text-destructive">00:00</div>
        <h2 className="mb-1 mt-2.5 font-heading text-2xl font-extrabold text-[#0F172A]">
          Réservation expirée.
        </h2>
        <p className="text-sm font-semibold text-secondary">
          Ton unité est repartie en vente. Retourne au drop pour en saisir une autre.
        </p>
      </div>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => navigate("/drop")}
          className="h-14 w-full rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-[17px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          Retourner au drop
        </button>
      </div>
    </div>
  );
}

export default function HoldPage() {
  const navigate = useNavigate();
  const [hold, setHold] = useState<ActiveHold | null>(null);
  const [expired, setExpired] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyHold()
      .then((h) => {
        if (alive) setHold(h);
      })
      .catch((e) => {
        if (!alive) return;
        // Only a real 404 (no_active_hold) means the hold is gone → expired view.
        // Any other failure (network/500) is a genuine error: don't lie to the
        // user that their reservation expired.
        if (apiErrorCode(e) === "no_active_hold") setExpired(true);
        else setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="drop" />
      {!loaded && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
        </div>
      )}
      {loaded && loadError && (
        <div className="flex flex-1 items-center justify-center px-5">
          <div
            role="alert"
            className="w-full max-w-[420px] rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]"
          >
            <p className="text-sm font-bold text-[#0F172A]">
              Impossible de charger ta réservation.
            </p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">
              Ta réservation n'est pas perdue. Réessaie dans un instant.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 h-11 rounded-[5px] border-2 border-[#323232] bg-accent px-5 text-sm font-extrabold text-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}
      {loaded && !loadError && !expired && hold && (
        <ActiveView hold={hold} onExpire={() => setExpired(true)} />
      )}
      {loaded && !loadError && expired && <ExpiredView />}
      {loaded && !loadError && !expired && !hold && (
        // Loaded, not expired, but no hold — shouldn't happen; bounce to drop.
        <div className="flex flex-1 items-center justify-center px-5">
          <button
            type="button"
            onClick={() => navigate("/drop")}
            className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent px-6 font-sans text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232]"
          >
            Aller au drop
          </button>
        </div>
      )}
    </div>
  );
}
