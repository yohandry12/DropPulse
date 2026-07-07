import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { apiErrorCode } from "../services/httpClient";
import { getMyDrops, type MyDrop } from "../services/myDropsService";

// D2 — "Mes drops". Lists the dropper's own drops (GET /products/mine), sorted
// by opening date. Each card shows the derived status badge + a stock bar
// (sold/total). Empty state prompts the first drop. Mirrors public/Espace
// Dropper.pdf + emptyDrop.jpg.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Opening date/time label ("10 juil. · 20 h 00" / "non programmée").
function dropAtLabel(iso: string | null): string {
  if (!iso) return "non programmée";
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time.replace(":", " h ")}`;
}

type Badge = { label: string; kind: "live" | "scheduled" | "draft" | "soldout" };

// Derive the display badge from stored status + dropAt + sold/total.
function deriveBadge(d: MyDrop): Badge {
  if (d.status === "DRAFT") return { label: "BROUILLON", kind: "draft" };
  const soldOut = d.unitCount > 0 && d.soldCount >= d.unitCount;
  if (soldOut) return { label: "ÉPUISÉ", kind: "soldout" };
  const open = d.dropAt != null && new Date(d.dropAt).getTime() <= Date.now();
  if (open) return { label: "LIVE", kind: "live" };
  return { label: "PROGRAMMÉ", kind: "scheduled" };
}

function BadgePill({ badge }: { badge: Badge }) {
  const base =
    "flex flex-none items-center gap-1.5 rounded-[5px] border-2 px-2 py-0.5 text-[11px] font-extrabold tracking-[0.5px]";
  if (badge.kind === "live") {
    return (
      <span className={`${base} border-[#323232] bg-white text-[#0F172A] shadow-[2px_2px_0_#323232]`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
        LIVE
      </span>
    );
  }
  if (badge.kind === "scheduled") {
    return <span className={`${base} border-accent bg-white text-accent`}>PROGRAMMÉ</span>;
  }
  if (badge.kind === "soldout") {
    return <span className={`${base} border-[#323232] bg-[#323232] text-white`}>ÉPUISÉ</span>;
  }
  return <span className={`${base} border-[#94A3B8] bg-muted text-[#64748B]`}>BROUILLON</span>;
}

// One drop row. Clickable → drop detail (D3 not built yet → public detail page).
function DropCard({ drop }: { drop: MyDrop }) {
  const badge = deriveBadge(drop);
  const total = drop.unitCount || 1;
  const pct = Math.round((drop.soldCount / total) * 100);
  const lastSerial = `#${String(drop.unitCount).padStart(3, "0")}`;

  return (
    <Link
      to={`/my-drops/${drop.id}`}
      className="flex items-center gap-4 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#323232] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#323232]"
    >
      {/* Thumbnail */}
      <div className="h-16 w-16 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
        {drop.imageUrl ? (
          <img src={drop.imageUrl} alt={`Visuel du drop ${drop.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]">
            <span className="font-mono text-[9px] text-[#94A3B8]">visuel</span>
          </div>
        )}
      </div>

      {/* Copy */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-heading text-[16px] font-extrabold text-[#0F172A]">
            {drop.name}
            {drop.edition ? ` « ${drop.edition} »` : ""}
          </span>
          <BadgePill badge={badge} />
        </div>
        <div className="text-[13px] font-bold tabular-nums text-secondary">
          #001 → {lastSerial} · {euros(drop.price)} € · {dropAtLabel(drop.dropAt)}
        </div>
      </div>

      {/* Stock bar */}
      <div className="hidden w-44 flex-none flex-col gap-1.5 md:flex">
        <div className="flex justify-between text-[12px] font-bold">
          <span className="text-[#64748B]">Stock écoulé</span>
          <span className="tabular-nums text-[#0F172A]">
            {drop.soldCount} / {drop.unitCount}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border-2 border-[#323232] bg-white">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <svg className="hidden flex-none text-[#94A3B8] md:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-4 rounded-[5px] border-2 border-dashed border-[#94A3B8] bg-white p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-muted">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 20 7 20 17 12 22 4 17 4 7 12 2" />
        </svg>
      </div>
      <div>
        <h2 className="font-heading text-[22px] font-extrabold text-[#0F172A]">
          Aucun drop encore — lance ton premier.
        </h2>
        <p className="mt-1 text-[14px] font-bold text-secondary">
          Programme une édition numérotée et suis tes ventes en direct ici.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/create")}
        className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent px-6 font-heading text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Créer mon premier drop
      </button>
    </div>
  );
}

export default function MyDropsPage() {
  const [drops, setDrops] = useState<MyDrop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyDrops()
      .then((d) => {
        if (alive) setDrops(d);
      })
      .catch((e) => {
        if (alive) setError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="create" />

      <div className="flex flex-1 flex-col gap-6 px-5 py-6 md:mx-auto md:w-full md:max-w-[1000px] md:px-12 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-[28px] font-extrabold leading-none text-[#0F172A] md:text-[34px]">
              Mes drops
            </h1>
            <p className="mt-1.5 text-[13px] font-bold text-secondary">
              Triés par date d'ouverture · {drops?.length ?? 0} drops créés
            </p>
          </div>
          <Link
            to="/create"
            className="flex h-11 items-center gap-1.5 rounded-[5px] border-2 border-[#323232] bg-accent px-4 font-heading text-[14px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Créer un drop
          </Link>
        </div>

        {error && (
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">Impossible de charger tes drops.</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
          </div>
        )}

        {!drops && !error && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-[5px] border-2 border-border bg-white" />
            ))}
          </div>
        )}

        {drops && drops.length === 0 && <EmptyState />}

        {drops && drops.length > 0 && (
          <div className="flex flex-col gap-3">
            {drops.map((d) => (
              <DropCard key={d.id} drop={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
