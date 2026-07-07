import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useProfile, clearProfileCache } from "../hooks/useProfile";
import { initialsFromEmail, setEmailNotifications } from "../services/userService";
import { logout } from "../services/authService";
import { useToast } from "../components/Toast";

// "Mon profil" screen: shows the authed user's email, join date, purchase
// count (GET /auth/me), plus logout. Light neobrutalist palette.

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// One stat cell for the profile summary.
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[5px] border-2 border-[#323232] bg-white py-3.5 text-center shadow-[4px_4px_0_#323232]">
      <div className="font-mono text-[28px] font-bold tabular-nums text-[#0F172A]">{value}</div>
      <div className="mt-0.5 text-[10px] font-extrabold tracking-[1.5px] text-[#64748B]">
        {label}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, error } = useProfile();

  // Email-notification toggle. Seeded from the profile once loaded, then owned
  // locally (optimistic) so the switch responds instantly.
  const [emailOn, setEmailOn] = useState(true);
  const [emailBusy, setEmailBusy] = useState(false);
  useEffect(() => {
    if (profile) setEmailOn(profile.emailNotifications);
  }, [profile]);

  async function toggleEmail() {
    if (emailBusy) return;
    setEmailBusy(true);
    const next = !emailOn;
    setEmailOn(next); // optimistic
    try {
      await setEmailNotifications(next);
      toast.success(next ? "Emails activés." : "Emails désactivés.");
    } catch {
      setEmailOn(!next); // revert on failure
      toast.error("Échec. Réessaie.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function onLogout() {
    try {
      await logout();
    } finally {
      clearProfileCache();
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="purchases" />

      <div className="flex flex-1 flex-col gap-5 px-5 py-6 md:mx-auto md:w-full md:max-w-[480px] md:px-0">
        <div>
          <div className="text-[11px] font-extrabold tracking-[2px] text-accent md:text-xs">
            MON PROFIL
          </div>
          <h1 className="mt-1 font-heading text-[28px] font-extrabold text-[#0F172A] md:text-[34px]">
            Ton compte
          </h1>
        </div>

        {error && (
          <div className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">Impossible de charger ton profil.</p>
          </div>
        )}

        {!profile && !error && (
          <div className="h-[120px] animate-pulse rounded-[5px] border-2 border-border bg-white" />
        )}

        {profile && (
          <>
            {/* Identity card */}
            <div className="flex items-center gap-4 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-primary text-xl font-extrabold text-white">
                {initialsFromEmail(profile.email)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-heading text-lg font-bold text-[#0F172A]">
                  {profile.email}
                </div>
                <div className="text-[13px] font-bold text-secondary">
                  Membre depuis {fmtMonth(profile.createdAt)}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <Stat value={String(profile.purchaseCount)} label="ACHATS" />
              <Stat value="#07" label="DERNIER DROP" />
            </div>

            {/* Preferences */}
            <div className="flex items-center justify-between gap-4 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
              <div className="min-w-0">
                <div className="font-heading text-[15px] font-bold text-[#0F172A]">
                  Notifications par email
                </div>
                <div className="text-[12px] font-semibold text-secondary">
                  Reçois un email à l'ouverture d'un drop et après un achat.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailOn}
                aria-label="Notifications par email"
                onClick={toggleEmail}
                disabled={emailBusy}
                className={`relative h-7 w-12 flex-none rounded-full border-2 border-[#323232] transition-colors disabled:opacity-60 ${
                  emailOn ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full border-2 border-[#323232] bg-white transition-transform ${
                    emailOn ? "translate-x-[18px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-auto flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/purchases")}
                className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-[17px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                Voir mes achats
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="h-11 rounded-[5px] border-2 border-destructive bg-transparent text-sm font-extrabold text-destructive transition-colors hover:bg-destructive hover:text-white"
              >
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
