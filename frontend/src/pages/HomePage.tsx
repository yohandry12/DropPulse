import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCountdown } from "../hooks/useCountdown";
import { getUpcomingDrops, type UpcomingDrop } from "../services/dropsService";
import { getProfile, initialsFromEmail, type UserProfile } from "../services/userService";
import { getAccessToken } from "../services/tokenStorage";

// Public landing / home. Reachable at "/" WITHOUT auth: a visitor discovers
// DropPulse before signing up. Adapts to auth: a logged-in user gets direct
// "rejoindre le drop" CTAs and their avatar; a visitor gets "créer un compte".
// Data (upcoming drops) comes from the public GET /products/upcoming.
//
// Auth probe: we only call GET /auth/me when an access token EXISTS. Calling it
// tokenless would 401 → the httpClient refresh interceptor would bounce the
// visitor to /login, breaking the public page. So: no token → treated as guest,
// no probe.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

// Relative day label for teasers.
function whenLabel(iso: string | null): string {
  if (!iso) return "Bientôt";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} j`;
}

// A hachured placeholder tile — the product's established "photo à venir" motif,
// used consistently across the app (not a bare colored block).
function HachureTile({ className = "", label }: { className?: string; label?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[repeating-linear-gradient(45deg,#1E293B_0_12px,#0F172A_12px_24px)] ${className}`}
    >
      {label && <span className="font-mono text-xs text-[#475569]">{label}</span>}
    </div>
  );
}

// Countdown cell on the dark hero.
function CountCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[5px] border-2 border-[#334155] bg-[#0F172A] py-3 text-center">
      <div className="font-mono text-[30px] font-bold leading-none tabular-nums text-white md:text-[40px]">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-extrabold tracking-[2px] text-[#64748B]">{label}</div>
    </div>
  );
}

function Hero({ drop, loggedIn }: { drop: UpcomingDrop | null; loggedIn: boolean }) {
  const navigate = useNavigate();
  const cd = useCountdown(drop?.dropAt ? new Date(drop.dropAt).getTime() : Date.now());

  return (
    <section className="relative overflow-hidden border-b-2 border-[#323232] bg-[#0F172A]">
      {/* Background loop. Muted + autoplay + playsInline = plays without gesture
          on mobile. aria-hidden: decorative. prefers-reduced-motion users get the
          poster still instead (see index.css). object-cover fills, overlay keeps
          the copy legible over any frame. */}
      <video
        className="home-hero-video absolute inset-0 h-full w-full object-cover opacity-40"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/dropPulse.mp4" type="video/mp4" />
      </video>
      {/* Gradient scrim: darkest on the left where the copy sits, so text stays
          ≥4.5:1 while the video breathes on the right. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.80) 45%, rgba(15,23,42,0.55) 100%)",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-14 md:px-12 md:py-24">
        {/* Copy */}
        <div className="flex flex-col gap-6">
          <p className="home-rise text-[13px] font-extrabold tracking-[2px] text-accent">
            SÉRIES NUMÉROTÉES · QUANTITÉS RÉELLES
          </p>
          <h1
            className="home-rise font-heading text-[42px] font-extrabold leading-[1.02] text-white md:text-[68px]"
            style={{ ["--delay" as string]: "80ms", textWrap: "balance" }}
          >
            Chaque unité porte un numéro. Il n'y en a pas d'autre.
          </h1>
          <p
            className="home-rise max-w-[52ch] text-[16px] font-semibold leading-relaxed text-[#94A3B8] md:text-[18px]"
            style={{ ["--delay" as string]: "160ms" }}
          >
            DropPulse ouvre des drops à date fixe. Tu réserves ton exemplaire, tu as
            quelques minutes pour payer, il est à toi. Pas de surventes, pas de
            réassort : quand la série part, elle part.
          </p>

          <div
            className="home-rise flex flex-col gap-3 sm:flex-row"
            style={{ ["--delay" as string]: "240ms" }}
          >
            {loggedIn ? (
              <button
                type="button"
                onClick={() => navigate("/drop")}
                className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent px-7 font-heading text-[16px] font-extrabold text-white shadow-[4px_4px_0_#000] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                Rejoindre le drop en cours
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-14 rounded-[5px] border-2 border-[#323232] bg-accent px-7 font-heading text-[16px] font-extrabold text-white shadow-[4px_4px_0_#000] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                Créer un compte
              </button>
            )}
            <Link
              to="/upcoming"
              className="flex h-14 items-center justify-center rounded-[5px] border-2 border-[#475569] px-7 text-[15px] font-extrabold text-white transition-colors hover:border-white"
            >
              Voir les drops à venir
            </Link>
          </div>
        </div>

        {/* Next-drop card */}
        <div
          className="home-rise rounded-[5px] border-2 border-[#334155] bg-[#0B1220] p-5 shadow-[6px_6px_0_#000] md:p-6"
          style={{ ["--delay" as string]: "200ms" }}
        >
          {drop ? (
            <>
              {drop.imageUrl ? (
                <img
                  src={drop.imageUrl}
                  alt={`Visuel du drop ${drop.name}`}
                  className="mb-4 h-[170px] w-full rounded-[5px] border-2 border-[#334155] object-cover"
                />
              ) : (
                <HachureTile className="mb-4 h-[170px] rounded-[5px] border-2 border-[#334155]" label={`— ${drop.name} —`} />
              )}
              <p className="text-[11px] font-extrabold tracking-[2px] text-accent">
                {cd.done ? "OUVERT MAINTENANT" : "PROCHAIN DROP"}
              </p>
              <h2 className="mt-1.5 font-heading text-[26px] font-extrabold text-white">{drop.name}</h2>
              <p className="mt-1 text-[13px] font-semibold text-[#94A3B8]">
                {drop.unitCount} unités numérotées · {euros(drop.price)} €
              </p>
              <div className="mt-4 flex gap-2.5">
                <CountCell value={cd.days} label="JOURS" />
                <CountCell value={cd.hoursOfDay} label="HEURES" />
                <CountCell value={cd.minutes} label="MIN" />
                <CountCell value={cd.seconds} label="SEC" />
              </div>
              <Link
                to={`/upcoming/${drop.id}`}
                className="mt-4 flex h-11 items-center justify-center rounded-[5px] border-2 border-accent text-[14px] font-extrabold text-accent transition-colors hover:bg-accent hover:text-white"
              >
                Voir ce drop
              </Link>
            </>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center">
              <p className="font-heading text-[20px] font-extrabold text-white">Aucun drop programmé.</p>
              <p className="text-[13px] font-semibold text-[#94A3B8]">Le prochain arrive bientôt.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// How it works — a genuine ordered 3-step flow (numbered because the order
// carries information, not as section scaffolding).
const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Le drop ouvre",
    body: "À l'heure dite, la série passe en live. Tu vois chaque exemplaire disponible, numéroté du premier au dernier.",
  },
  {
    n: "2",
    title: "Tu réserves ton numéro",
    body: "Un clic met l'unité de côté pour toi. Le compteur démarre : quelques minutes pour confirmer, sinon elle repart en jeu.",
  },
  {
    n: "3",
    title: "Tu paies, il est à toi",
    body: "Paiement validé, l'exemplaire est verrouillé à ton nom. Aucun autre acheteur ne peut l'avoir. Il n'existe qu'une fois.",
  },
];

function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 py-16 md:px-12 md:py-24">
      <h2 className="max-w-[18ch] font-heading text-[30px] font-extrabold leading-tight text-[#0F172A] md:text-[44px]" style={{ textWrap: "balance" }}>
        Trois étapes, chrono en main.
      </h2>
      <ol className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className="home-rise flex flex-col gap-3 rounded-[5px] border-2 border-[#323232] bg-white p-6 shadow-[4px_4px_0_#323232]"
            style={{ ["--delay" as string]: `${i * 90}ms` }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[20px] font-extrabold text-white">
              {s.n}
            </span>
            <h3 className="font-heading text-[19px] font-extrabold text-[#0F172A]">{s.title}</h3>
            <p className="text-[14px] font-semibold leading-relaxed text-secondary">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function UpcomingStrip({ drops }: { drops: UpcomingDrop[] }) {
  if (drops.length === 0) return null;
  return (
    <section className="border-y-2 border-[#323232] bg-muted">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-16 md:px-12 md:py-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-[28px] font-extrabold text-[#0F172A] md:text-[38px]">
            Ce qui arrive
          </h2>
          <Link to="/upcoming" className="flex-none text-[14px] font-extrabold text-accent hover:underline">
            Tout voir →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drops.slice(0, 6).map((d, i) => (
            <Link
              key={d.id}
              to={`/upcoming/${d.id}`}
              className="home-rise flex items-center gap-4 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#323232]"
              style={{ ["--delay" as string]: `${i * 70}ms` }}
            >
              {d.imageUrl ? (
                <img
                  src={d.imageUrl}
                  alt={`Visuel du drop ${d.name}`}
                  className="h-16 w-16 flex-none rounded-[5px] border-2 border-[#323232] object-cover"
                />
              ) : (
                <HachureTile className="h-16 w-16 flex-none rounded-[5px] border-2 border-[#323232]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[16px] font-bold text-[#0F172A]">{d.name}</p>
                <p className="text-[13px] font-bold tabular-nums text-secondary">
                  {euros(d.price)} € · {d.unitCount} unités
                </p>
              </div>
              <span className="flex-none rounded-[5px] border-2 border-border bg-muted px-2.5 py-1 text-[11px] font-extrabold text-[#334155]">
                {whenLabel(d.dropAt)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ loggedIn }: { loggedIn: boolean }) {
  const navigate = useNavigate();
  if (loggedIn) return null;
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 py-20 text-center md:px-12 md:py-28">
      <h2 className="mx-auto max-w-[20ch] font-heading text-[32px] font-extrabold leading-tight text-[#0F172A] md:text-[48px]" style={{ textWrap: "balance" }}>
        Le prochain numéro peut être le tien.
      </h2>
      <p className="mx-auto mt-4 max-w-[46ch] text-[16px] font-semibold text-secondary">
        Crée ton compte en une minute et sois là quand le drop ouvre.
      </p>
      <button
        type="button"
        onClick={() => navigate("/login")}
        className="mt-8 h-14 rounded-[5px] border-2 border-[#323232] bg-accent px-9 font-heading text-[16px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Créer un compte
      </button>
    </section>
  );
}

// Lightweight public header — logo + auth-aware action (not AppHeader, which
// assumes an authenticated ProfileMenu).
function PublicHeader({ profile }: { profile: UserProfile | null }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b-2 border-[#323232] bg-white px-5 md:h-16 md:px-12">
      <Link to="/" className="font-heading text-lg font-extrabold text-[#0F172A] md:text-xl">
        DropPulse
      </Link>
      <div className="flex items-center gap-3">
        <Link to="/upcoming" className="hidden text-[14px] font-semibold text-[#64748B] hover:text-[#0F172A] sm:block">
          Drops à venir
        </Link>
        {profile ? (
          <Link
            to="/drop"
            className="flex items-center gap-2 rounded-[5px] border-2 border-[#323232] bg-white px-3 py-1.5 text-[13px] font-extrabold text-[#0F172A] shadow-[2px_2px_0_#323232]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white">
              {initialsFromEmail(profile.email)}
            </span>
            Mon espace
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-[5px] border-2 border-[#323232] bg-accent px-4 py-2 text-[13px] font-extrabold text-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            Se connecter
          </Link>
        )}
      </div>
    </header>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [drops, setDrops] = useState<UpcomingDrop[]>([]);

  // Auth probe only when a token exists (see file header).
  useEffect(() => {
    if (!getAccessToken()) return;
    let alive = true;
    getProfile()
      .then((p) => alive && setProfile(p))
      .catch(() => {}); // tokenless / expired → stay a guest, no bounce
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getUpcomingDrops()
      .then((d) => alive && setDrops(d))
      .catch(() => {}); // public page: a fetch failure just hides the list
    return () => {
      alive = false;
    };
  }, []);

  const loggedIn = profile !== null;
  const hero = useMemo(() => drops[0] ?? null, [drops]);

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader profile={profile} />
      <Hero drop={hero} loggedIn={loggedIn} />
      <HowItWorks />
      <UpcomingStrip drops={drops} />
      <ClosingCta loggedIn={loggedIn} />

      <footer className="border-t-2 border-[#323232] bg-white">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-3 px-5 py-8 text-center sm:flex-row sm:text-left md:px-12">
          <span className="font-heading text-[15px] font-extrabold text-[#0F172A]">DropPulse</span>
          <span className="text-[12px] font-semibold text-secondary">
            Séries limitées, numérotées, premier arrivé premier servi.
          </span>
        </div>
      </footer>
    </div>
  );
}
