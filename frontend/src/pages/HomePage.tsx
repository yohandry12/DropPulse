import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCountdown } from "../hooks/useCountdown";
import { getUpcomingDrops, type UpcomingDrop } from "../services/dropsService";
import { getProfile, initialsFromEmail, type UserProfile } from "../services/userService";
import { getAccessToken } from "../services/tokenStorage";

gsap.registerPlugin(ScrollTrigger);

// Cinematic public landing at "/". A scroll-narrative built from four campaign
// assets: pulse-of-the-culture, the tech reservation, numbered scarcity, and
// the live drop. Adapts to auth (logged-in → "rejoindre", guest → "créer un
// compte"). Data from public GET /products/upcoming. Motion is GSAP-driven;
// reduced-motion collapses every reveal to its visible resting state (see CSS).

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function whenLabel(iso: string | null): string {
  if (!iso) return "Bientôt";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} j`;
}

// -- Lightweight public header (not AppHeader, which assumes an authed menu). --
function PublicHeader({ profile }: { profile: UserProfile | null }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-[#0B0F14]/80 px-5 backdrop-blur-md md:h-16 md:px-12">
      <Link to="/" className="font-heading text-lg font-extrabold tracking-tight text-white md:text-xl">
        DropPulse
      </Link>
      <div className="flex items-center gap-3 md:gap-5">
        <Link
          to="/upcoming"
          className="hidden text-[13px] font-semibold text-white/60 transition-colors hover:text-white sm:block"
        >
          Drops à venir
        </Link>
        {profile ? (
          <Link
            to="/drop"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[13px] font-extrabold text-white transition-colors hover:bg-white/10"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-white">
              {initialsFromEmail(profile.email)}
            </span>
            Mon espace
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-full bg-accent px-4 py-2 text-[13px] font-extrabold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Se connecter
          </Link>
        )}
      </div>
    </header>
  );
}

// A countdown cell rendered over dark backgrounds.
function CountCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[6px] border border-white/15 bg-white/5 py-3 text-center backdrop-blur-sm">
      <div className="font-mono text-[28px] font-bold leading-none tabular-nums text-white md:text-[38px]">
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-extrabold tracking-[2.5px] text-white/45 md:text-[10px]">
        {label}
      </div>
    </div>
  );
}

// -- Scene 1: HERO. Full-bleed pomelli video, drenched dark, live countdown. --
function Hero({ drop, loggedIn }: { drop: UpcomingDrop | null; loggedIn: boolean }) {
  const navigate = useNavigate();
  const cd = useCountdown(drop?.dropAt ? new Date(drop.dropAt).getTime() : Date.now());

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#0B0F14] pb-16 pt-28 md:pb-16 md:pt-20">
      <video
        className="home-hero-video absolute inset-0 h-full w-full object-cover opacity-40"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/pomelli.mp4" type="video/mp4" />
      </video>
      {/* Base darkening + slight blur drowns the video's own embedded marketing
          text so only the HTML copy reads. Heavier on mobile where the portrait
          crop shows more of the source text. */}
      <div className="absolute inset-0 bg-[#0B0F14]/70 backdrop-blur-[2px] md:bg-[#0B0F14]/55" aria-hidden="true" />
      {/* Left-to-right + bottom scrim: darkest where the copy sits, video breathes
          on the right and top-right (desktop). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(11,15,20,0.94) 0%, rgba(11,15,20,0.65) 42%, rgba(11,15,20,0.4) 70%), linear-gradient(180deg, rgba(11,15,20,0.5) 0%, transparent 30%, transparent 55%, rgba(11,15,20,0.92) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1240px] gap-10 px-5 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-14 md:px-12">
        {/* Copy */}
        <div className="flex flex-col gap-6">
          <span className="lx-reveal inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[2px] text-accent md:text-[12px]">
            <span className="lx-pulse h-1.5 w-1.5 rounded-full bg-accent" />
            SÉRIES NUMÉROTÉES · PREMIER ARRIVÉ
          </span>
          <h1 className="lx-reveal font-heading text-[46px] font-extrabold leading-[0.98] tracking-tight text-white md:text-[80px]" style={{ textWrap: "balance" }}>
            Le pouls de la culture.
          </h1>
          <p className="lx-reveal max-w-[46ch] text-[16px] font-semibold leading-relaxed text-white/70 md:text-[18px]">
            DropPulse ouvre des séries à date fixe. Tu réserves ton exemplaire
            numéroté, quelques minutes pour payer, il est à toi. Pas de survente,
            pas de réassort.
          </p>
          <div className="lx-reveal flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(loggedIn ? "/drop" : "/login")}
              className="group relative h-14 overflow-hidden rounded-full bg-accent px-8 font-heading text-[16px] font-extrabold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              {loggedIn ? "Rejoindre le drop en cours" : "Créer un compte"}
            </button>
            <Link
              to="/upcoming"
              className="flex h-14 items-center justify-center rounded-full border border-white/25 px-8 text-[15px] font-extrabold text-white transition-colors hover:border-white hover:bg-white/5"
            >
              Voir les drops à venir
            </Link>
          </div>
        </div>

        {/* Next-drop live card */}
        <div className="lx-reveal rounded-[10px] border border-white/12 bg-white/[0.04] p-5 backdrop-blur-md md:p-6">
          {drop ? (
            <>
              <div className="mb-4 h-[150px] w-full overflow-hidden rounded-[6px] border border-white/10">
                {drop.imageUrl ? (
                  <img src={drop.imageUrl} alt={`Visuel du drop ${drop.name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#1E293B_0_12px,#111827_12px_24px)]">
                    <span className="font-mono text-xs text-white/40">— {drop.name} —</span>
                  </div>
                )}
              </div>
              <p className="flex items-center gap-2 text-[11px] font-extrabold tracking-[2px] text-accent">
                <span className="lx-pulse h-1.5 w-1.5 rounded-full bg-accent" />
                {cd.done ? "OUVERT MAINTENANT" : "PROCHAIN DROP"}
              </p>
              <h2 className="mt-1.5 font-heading text-[24px] font-extrabold text-white">{drop.name}</h2>
              <p className="mt-1 text-[13px] font-semibold text-white/55">
                {drop.unitCount} unités numérotées · {euros(drop.price)} €
              </p>
              <div className="mt-4 flex gap-2">
                <CountCell value={cd.days} label="JOURS" />
                <CountCell value={cd.hoursOfDay} label="HEURES" />
                <CountCell value={cd.minutes} label="MIN" />
                <CountCell value={cd.seconds} label="SEC" />
              </div>
              <Link
                to={`/upcoming/${drop.id}`}
                className="mt-4 flex h-11 items-center justify-center rounded-full border border-accent text-[14px] font-extrabold text-accent transition-colors hover:bg-accent hover:text-white"
              >
                Voir ce drop
              </Link>
            </>
          ) : (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 text-center">
              <p className="font-heading text-[20px] font-extrabold text-white">Aucun drop programmé.</p>
              <p className="text-[13px] font-semibold text-white/55">Le prochain arrive bientôt.</p>
            </div>
          )}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center md:flex" aria-hidden="true">
        <span className="text-[11px] font-extrabold tracking-[3px] text-white/40">DÉFILE</span>
      </div>
    </section>
  );
}

// -- Full-bleed pinned scene with an image + overlaid copy. Reused for the
//    narrative beats (pulse, scarcity, live-drop). --
function CinematicScene({
  image,
  alt,
  eyebrow,
  title,
  body,
  align = "left",
  tint = "#0B0F14",
}: {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "right" | "center";
  tint?: string;
}) {
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
      ? "items-start md:items-end md:text-right"
      : "items-start";
  return (
    <section className="lx-scene relative flex min-h-[92svh] items-center overflow-hidden" style={{ backgroundColor: tint }}>
      <div className="lx-scene-img absolute inset-0 h-[120%] w-full will-change-transform">
        <img src={image} alt={alt} className="h-full w-full object-cover opacity-55" />
      </div>
      {/* Base darkening so the assets' own embedded marketing text is drowned out
          and reads as pure atmosphere behind the HTML copy. */}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      {/* Directional scrim toward the copy side for text contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            align === "center"
              ? `linear-gradient(180deg, ${tint}ee 0%, ${tint}88 45%, ${tint}f5 100%)`
              : align === "right"
              ? `linear-gradient(270deg, ${tint}f2 0%, ${tint}aa 45%, ${tint}55 100%)`
              : `linear-gradient(90deg, ${tint}f2 0%, ${tint}aa 45%, ${tint}55 100%)`,
        }}
        aria-hidden="true"
      />
      <div className={`relative z-10 mx-auto flex w-full max-w-[1240px] flex-col ${alignClass} gap-5 px-5 py-24 md:px-12`}>
        <span className="lx-reveal inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[2px] text-accent">
          {eyebrow}
        </span>
        <h2 className="lx-reveal max-w-[16ch] font-heading text-[38px] font-extrabold leading-[1.02] tracking-tight text-white md:text-[64px]" style={{ textWrap: "balance" }}>
          {title}
        </h2>
        <p className="lx-reveal max-w-[48ch] text-[16px] font-semibold leading-relaxed text-white/75 md:text-[19px]">
          {body}
        </p>
      </div>
    </section>
  );
}

// -- The 3-step flow, integrated over the tech (peak) asset. --
const STEPS = [
  { n: "01", title: "Le drop ouvre", body: "À l'heure dite, la série passe en live. Chaque exemplaire disponible, numéroté du premier au dernier." },
  { n: "02", title: "Tu réserves ton numéro", body: "Un clic met l'unité de côté. Le compteur démarre : quelques minutes pour confirmer, sinon elle repart en jeu." },
  { n: "03", title: "Tu paies, il est à toi", body: "Paiement validé, l'exemplaire est verrouillé à ton nom. Il n'existe qu'une fois." },
] as const;

function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-[#0B0F14] py-24 md:py-32">
      {/* peak.png cropped to just the floating sneaker (right half of the source),
          low opacity + fade so its embedded "PEAK HEAT" text never reads. */}
      <img
        src="/peak.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-1/2 hidden h-[135%] max-w-none -translate-y-1/2 object-cover opacity-[0.18] md:block"
        style={{
          width: "55%",
          objectPosition: "50% 62%",
          maskImage: "radial-gradient(circle at 60% 55%, black 30%, transparent 72%)",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-5 md:px-12">
        <h2 className="lx-reveal max-w-[14ch] font-heading text-[34px] font-extrabold leading-tight tracking-tight text-white md:text-[52px]" style={{ textWrap: "balance" }}>
          Trois étapes, chrono en main.
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="lx-step flex flex-col gap-3 bg-[#0B0F14] p-7 md:p-8">
              <span className="font-mono text-[15px] font-bold tracking-widest text-accent">{s.n}</span>
              <h3 className="font-heading text-[20px] font-extrabold text-white">{s.title}</h3>
              <p className="text-[14px] font-semibold leading-relaxed text-white/60">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// -- Numbered-edition ticker strip. --
function Ticker() {
  const words = ["NUMÉROTÉ", "UNIQUE", "PREMIER ARRIVÉ", "PAS DE RÉASSORT", "PIÈCE PAR PIÈCE", "LIVE"];
  const row = [...words, ...words];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-accent py-4">
      <div className="lx-ticker flex w-max gap-8 whitespace-nowrap">
        {row.map((w, i) => (
          <span key={i} className="font-heading text-[15px] font-extrabold tracking-[2px] text-white/95">
            {w} <span className="text-white/40">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function UpcomingStrip({ drops }: { drops: UpcomingDrop[] }) {
  if (drops.length === 0) return null;
  return (
    <section className="bg-[#0B0F14] py-24 md:py-28">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="lx-reveal font-heading text-[30px] font-extrabold tracking-tight text-white md:text-[44px]">
            Ce qui arrive
          </h2>
          <Link to="/upcoming" className="flex-none text-[14px] font-extrabold text-accent transition-colors hover:text-white">
            Tout voir →
          </Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drops.slice(0, 6).map((d) => (
            <Link
              key={d.id}
              to={`/upcoming/${d.id}`}
              viewTransition
              className="lx-card group flex items-center gap-4 rounded-[10px] border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-accent/50 hover:bg-white/[0.06]"
            >
              <div className="h-16 w-16 flex-none overflow-hidden rounded-[6px] border border-white/10">
                {d.imageUrl ? (
                  <img src={d.imageUrl} alt={`Visuel du drop ${d.name}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#1E293B_0_8px,#111827_8px_16px)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[16px] font-bold text-white">{d.name}</p>
                <p className="text-[13px] font-bold tabular-nums text-white/50">
                  {euros(d.price)} € · {d.unitCount} unités
                </p>
              </div>
              <span className="flex-none rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-extrabold text-white/70">
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
    <section className="relative overflow-hidden bg-[#0B0F14] py-28 text-center md:py-36">
      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-5 md:px-12">
        <h2 className="lx-reveal mx-auto max-w-[18ch] font-heading text-[36px] font-extrabold leading-tight tracking-tight text-white md:text-[60px]" style={{ textWrap: "balance" }}>
          Le prochain numéro peut être le tien.
        </h2>
        <p className="lx-reveal mx-auto mt-4 max-w-[44ch] text-[16px] font-semibold text-white/65 md:text-[18px]">
          Crée ton compte en une minute et sois là quand le drop ouvre.
        </p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="lx-reveal mt-9 h-14 rounded-full bg-accent px-10 font-heading text-[16px] font-extrabold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Créer un compte
        </button>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [drops, setDrops] = useState<UpcomingDrop[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    let alive = true;
    getProfile().then((p) => alive && setProfile(p)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getUpcomingDrops().then((d) => alive && setDrops(d)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loggedIn = profile !== null;
  const hero = useMemo(() => drops[0] ?? null, [drops]);

  // GSAP scroll choreography. Runs after drops load so newly-mounted sections
  // (UpcomingStrip) are included. Scoped via gsap.context for clean teardown.
  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // CSS already shows everything at rest

    const root = rootRef.current!;
    const ctx = gsap.context(() => {
      // Hero copy: staggered entrance on load (the hero <section> is first).
      const heroSection = root.querySelector("section");
      const heroReveals = heroSection
        ? Array.from(heroSection.querySelectorAll<HTMLElement>(".lx-reveal"))
        : [];
      if (heroReveals.length) {
        gsap.from(heroReveals, {
          opacity: 0,
          y: 28,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.1,
          delay: 0.15,
        });
      }

      // Scroll reveals for every OTHER section (skip the hero, handled above).
      // gsap.from so the resting state is visible even if a trigger never fires.
      const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
      sections.slice(1).forEach((section) => {
        const reveals = section.querySelectorAll<HTMLElement>(".lx-reveal");
        const revealsX = section.querySelectorAll<HTMLElement>(".lx-reveal-x");
        if (reveals.length) {
          gsap.from(reveals, {
            opacity: 0,
            y: 28,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.12,
            // immediateRender:false → the hidden `from` state is applied only
            // when the trigger fires, so content stays visible until scrolled to
            // (and never gets stuck hidden if the trigger never runs).
            immediateRender: false,
            scrollTrigger: { trigger: section, start: "top 80%" },
          });
        }
        if (revealsX.length) {
          gsap.from(revealsX, {
            opacity: 0,
            x: -40,
            duration: 0.85,
            ease: "power3.out",
            stagger: 0.12,
            immediateRender: false,
            scrollTrigger: { trigger: section, start: "top 80%" },
          });
        }
      });

      // Parallax on cinematic scene images: image drifts slower than scroll.
      root.querySelectorAll<HTMLElement>(".lx-scene-img").forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: "none",
            scrollTrigger: {
              trigger: img.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      });

      // How-it-works steps: reveal in sequence as the block enters.
      const steps = Array.from(root.querySelectorAll<HTMLElement>(".lx-step"));
      if (steps.length) {
        gsap.from(steps, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.14,
          immediateRender: false,
          scrollTrigger: { trigger: steps[0], start: "top 84%" },
        });
      }

      // Upcoming cards: gentle staggered rise.
      const cards = Array.from(root.querySelectorAll<HTMLElement>(".lx-card"));
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0,
          y: 24,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          immediateRender: false,
          scrollTrigger: { trigger: cards[0], start: "top 87%" },
        });
      }
    }, rootRef);

    // Recalculate once images/video affect layout.
    const t = setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [drops.length]);

  return (
    <div ref={rootRef} className="min-h-dvh bg-[#0B0F14]">
      <PublicHeader profile={profile} />

      <Hero drop={hero} loggedIn={loggedIn} />

      <CinematicScene
        image="/adrenaline.png"
        alt="Un groupe réuni autour d'un téléphone au moment où un drop est confirmé, devant un bâtiment en béton"
        eyebrow="LA COMMUNAUTÉ"
        title="L'adrénaline de la chasse."
        body="C'est le frisson du drop et la communauté qui garde le rythme. Quand la série ouvre, tout le monde est là, au même instant. Entre dans la danse."
        align="left"
      />

      <HowItWorks />

      <Ticker />

      <CinematicScene
        image="/secure.png"
        alt="Un sac tactique numéroté 08/100, porté en mouvement dans la rue"
        eyebrow="TON SIGNAL"
        title="45 unités. Pas une de plus."
        body="Chaque pièce porte son numéro, il n'y en a pas d'autre. Pas de survente, pas de réassort : ce que tu réserves est unique, gravé à ton nom."
        align="right"
        tint="#0B0F14"
      />

      <CinematicScene
        image="/reservation.png"
        alt="Un boîtier affichant « RESERVATION LIVE » devant des montagnes au coucher du soleil"
        eyebrow="C'EST PARTI"
        title="Le drop a commencé."
        body="L'unité #001 est sur la grille. La tension monte, le compteur tourne. Réserve ton numéro avant qu'il reparte en jeu."
        align="center"
        tint="#120A0A"
      />

      <UpcomingStrip drops={drops} />

      <ClosingCta loggedIn={loggedIn} />

      <footer className="border-t border-white/10 bg-[#0B0F14]">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-5 py-10 md:px-12">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:text-left">
            <span className="font-heading text-[15px] font-extrabold text-white">DropPulse</span>
            <span className="text-[12px] font-semibold text-white/45">
              Séries limitées, numérotées, premier arrivé premier servi.
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 sm:justify-start">
            <Link to="/confidentialite" className="text-[12px] font-semibold text-white/50 transition-colors hover:text-white">
              Confidentialité
            </Link>
            <Link to="/mentions-legales" className="text-[12px] font-semibold text-white/50 transition-colors hover:text-white">
              Mentions légales
            </Link>
            <Link to="/cgu" className="text-[12px] font-semibold text-white/50 transition-colors hover:text-white">
              Conditions générales
            </Link>
            <Link to="/cookies" className="text-[12px] font-semibold text-white/50 transition-colors hover:text-white">
              Cookies
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
