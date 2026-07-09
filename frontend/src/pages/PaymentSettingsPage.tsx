import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Spinner from "../components/Spinner";
import { apiErrorCode } from "../services/httpClient";
import {
  getPayoutStatus,
  openPayoutDashboard,
  refreshPayoutStatus,
  startPayoutOnboarding,
  type PayoutStatus,
} from "../services/payoutService";

// Dropper payout settings (/settings/payments). Shows Stripe Connect onboarding
// state and a CTA to configure/resume it. On return from Stripe (?done / ?refresh
// in the URL), re-syncs status from Stripe so the "active" state reflects reality.

export default function PaymentSettingsPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load status. If we just came back from onboarding, hit the refresh endpoint
  // (pulls charges_enabled from Stripe); otherwise the cheap cached read.
  useEffect(() => {
    const returned = params.has("done") || params.has("refresh");
    const fetcher = returned ? refreshPayoutStatus : getPayoutStatus;
    fetcher()
      .then(setStatus)
      .catch(() => setError("Impossible de charger le statut des paiements."));
    if (returned) {
      // Clean the query so a manual refresh doesn't re-trigger the Stripe sync.
      params.delete("done");
      params.delete("refresh");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onboard() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await startPayoutOnboarding();
      window.location.assign(url);
    } catch (e) {
      const code = apiErrorCode(e);
      setError(
        code === "connect_not_enabled"
          ? "Les paiements ne sont pas encore activés sur la plateforme. Contacte l'administrateur."
          : "Impossible de démarrer la configuration. Réessaie."
      );
      setBusy(false);
    }
  }

  async function manage() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await openPayoutDashboard();
      window.location.assign(url);
    } catch {
      setError("Impossible d'ouvrir ton compte de paiement. Réessaie.");
      setBusy(false);
    }
  }

  const active = status?.chargesEnabled === true;
  const started = status?.hasAccount === true;
  // Commission rate for display. feeBps 800 -> "8". Strips a trailing ".0".
  const feePct = status ? String(status.feeBps / 100).replace(/\.0$/, "") : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="create" />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-10 md:px-8 md:py-14">
        <h1 className="font-heading text-[28px] font-extrabold text-[#0F172A] md:text-[36px]">
          Paiements
        </h1>
        <p className="mt-2 max-w-[54ch] text-[15px] font-semibold text-secondary">
          Pour recevoir l'argent de tes ventes, connecte ton compte de paiement.
          Tes coordonnées bancaires sont gérées et sécurisées par Stripe — nous
          ne les stockons jamais.
        </p>

        {/* Status card */}
        <div className="mt-8 rounded-[5px] border-2 border-[#323232] bg-white p-6 shadow-[4px_4px_0_#323232]">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 flex-none rounded-full ${
                active ? "bg-accent" : "bg-destructive"
              }`}
            />
            <span className="font-heading text-[18px] font-extrabold text-[#0F172A]">
              {status === null
                ? "Chargement…"
                : active
                ? "Compte actif — tu peux recevoir des paiements"
                : started
                ? "Configuration incomplète"
                : "Aucun compte de paiement"}
            </span>
          </div>

          {!active && status !== null && (
            <p className="mt-3 text-[14px] font-semibold text-secondary">
              {started
                ? "Ta configuration Stripe n'est pas terminée. Reprends-la pour pouvoir encaisser."
                : "Configure ton compte Stripe pour commencer à vendre et recevoir l'argent."}
            </p>
          )}

          {!active && (
            <button
              type="button"
              onClick={onboard}
              disabled={busy || status === null}
              className="mt-5 h-12 rounded-[5px] border-2 border-[#323232] bg-accent px-6 font-heading text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Redirection…
                </span>
              ) : started ? (
                "Reprendre la configuration"
              ) : (
                "Configurer les paiements"
              )}
            </button>
          )}

          {active && (
            <>
              <p className="mt-3 text-[14px] font-semibold text-secondary">
                Gère ton compte bancaire, tes informations et suis tes paiements
                sur ton espace Stripe.
              </p>
              <button
                type="button"
                onClick={manage}
                disabled={busy}
                className="mt-5 h-12 rounded-[5px] border-2 border-[#323232] bg-white px-6 font-heading text-[15px] font-extrabold text-[#0F172A] shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Redirection…
                  </span>
                ) : (
                  "Gérer mon compte de paiement"
                )}
              </button>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-[5px] border-2 border-destructive bg-white p-3 shadow-[2px_2px_0_#DC2626]"
            >
              <p className="text-[13px] font-bold text-[#0F172A]">{error}</p>
            </div>
          )}
        </div>

        {/* Commission — how the split works, so the dropper knows exactly what
            they keep on each sale. Rate comes from the backend (feeBps). */}
        {feePct !== null && (
          <div className="mt-5 rounded-[5px] border-2 border-[#323232] bg-white p-6 shadow-[4px_4px_0_#323232]">
            <h2 className="font-heading text-[18px] font-extrabold text-[#0F172A]">
              Commission
            </h2>
            <p className="mt-2 max-w-[54ch] text-[14px] font-semibold text-secondary">
              Sur chaque vente, DropPulse prélève{" "}
              <span className="font-extrabold text-[#0F172A]">{feePct}%</span>. Le
              reste t'est reversé automatiquement sur ton compte Stripe.
            </p>
            <div className="mt-4 flex gap-3">
              <div className="flex-1 rounded-[5px] border-2 border-border bg-background p-3 text-center">
                <div className="font-mono text-[22px] font-bold tabular-nums text-[#0F172A]">
                  {feePct}%
                </div>
                <div className="mt-0.5 text-[10px] font-extrabold tracking-[1.2px] text-[#64748B]">
                  COMMISSION
                </div>
              </div>
              <div className="flex-1 rounded-[5px] border-2 border-accent bg-background p-3 text-center">
                <div className="font-mono text-[22px] font-bold tabular-nums text-accent">
                  {status ? 100 - status.feeBps / 100 : 0}%
                </div>
                <div className="mt-0.5 text-[10px] font-extrabold tracking-[1.2px] text-[#64748B]">
                  POUR TOI
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
