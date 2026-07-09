import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import DropSwitcher from "../components/DropSwitcher";
import { apiErrorCode } from "../services/httpClient";
import {
  getLiveDrops,
  getLiveDrop,
  holdUnit,
  type DropUnit,
  type LiveDrop,
  type LiveDropSummary,
  type UnitStatus,
} from "../services/dropService";

// "Drop actif — A « Lisible »" screen (maquette block 1a), wired to the live
// backend drop (GET /products/live). Dense numbered grid: click an available
// unit to reserve it (POST /units/:id/hold) then jump to the hold screen.

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });
}

// Serials are stored as "<drop-prefix>-<number>" (e.g. "905d28b6-0011"); the box
// only needs the human number. The drop name already sits in the title, so we
// show just the numbered tail: "#0011".
function unitLabel(serialNumber: string): string {
  return `#${serialNumber.split("-").pop() ?? serialNumber}`;
}

// Per-status unit-button styling, straight from the maquette legend.
function unitClass(status: UnitStatus): string {
  const base =
    "h-[52px] rounded-[5px] font-mono text-[13px] font-bold tabular-nums transition-transform md:h-[54px] md:text-sm disabled:cursor-not-allowed";
  switch (status) {
    case "available":
      return `${base} border-2 border-[#323232] bg-white text-[#0F172A] shadow-[2px_2px_0_#323232] cursor-pointer hover:-translate-x-px hover:-translate-y-px`;
    case "held":
      return `${base} border-2 border-[#334155] bg-[#475569] text-white`;
    case "sold":
      return `${base} border-2 border-[#E2E8F0] bg-[#E2E8F0] text-[#94A3B8] line-through`;
  }
}

function Legend() {
  return (
    <div className="flex gap-4">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-secondary md:text-xs">
        <span className="h-3 w-3 rounded-[3px] border-2 border-[#323232] bg-white" />
        Disponible
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-secondary md:text-xs">
        <span className="h-3 w-3 rounded-[3px] bg-[#475569]" />
        Réservée
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-secondary md:text-xs">
        <span className="h-3 w-3 rounded-[3px] bg-[#E2E8F0]" />
        Vendue
      </span>
    </div>
  );
}

function StockBar({
  availCount,
  soldCount,
  heldCount,
  pctLeft,
}: {
  availCount: number;
  soldCount: number;
  heldCount: number;
  pctLeft: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold text-[#0F172A] md:text-[15px]">
          <span className="font-mono text-accent md:text-xl">{availCount}</span> disponibles
        </span>
        <span className="text-xs font-semibold tabular-nums text-[#64748B] md:text-[13px]">
          {soldCount} vendues · {heldCount} réservées
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white md:h-[14px]">
        <div
          className="h-full bg-accent transition-[width] duration-500"
          style={{ width: `${pctLeft}%` }}
        />
      </div>
    </div>
  );
}

function UnitGrid({
  units,
  cols,
  onPick,
  busy,
}: {
  units: DropUnit[];
  cols: "5" | "10";
  onPick: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className={`grid gap-2 ${cols === "5" ? "grid-cols-5" : "grid-cols-10 gap-2.5"}`}>
      {units.map((u) => (
        <button
          key={u.id}
          type="button"
          disabled={u.status !== "available" || busy}
          onClick={() => onPick(u.id)}
          className={unitClass(u.status)}
          aria-label={`Unité ${unitLabel(u.serialNumber)} — ${u.status}`}
        >
          {unitLabel(u.serialNumber)}
        </button>
      ))}
    </div>
  );
}

// Human-readable message for a hold conflict.
function holdErrorMessage(code: string): string {
  switch (code) {
    case "unit_unavailable":
      return "Trop tard, cette unité vient de partir.";
    case "user_already_holding":
      return "Tu as déjà une réservation en cours.";
    case "max_per_buyer_reached":
      return "Limite atteinte : tu as déjà le maximum d'unités autorisé sur ce drop.";
    case "unit_not_found":
      return "Unité introuvable.";
    default:
      return "La réservation a échoué. Réessaie.";
  }
}

export default function DropPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  // All currently-live drops (for the switcher) + the one being viewed.
  const [liveDrops, setLiveDrops] = useState<LiveDropSummary[] | null>(null);
  const [drop, setDrop] = useState<LiveDrop | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);

  // The drop to show: the route id if it still points at a live drop, else the
  // most recent live drop. Guarding against a dead routeId (a drop that closed
  // since the link was shared) avoids a 404 that would strand the user on an
  // error screen instead of falling back to what's actually live.
  const selectedId = useMemo(() => {
    if (liveDrops === null) return routeId ?? null; // list not loaded yet
    if (routeId && liveDrops.some((d) => d.id === routeId)) return routeId;
    return liveDrops[0]?.id ?? null;
  }, [routeId, liveDrops]);

  // 1. Load the list of live drops once.
  useEffect(() => {
    let alive = true;
    getLiveDrops()
      .then((ds) => {
        if (alive) setLiveDrops(ds);
      })
      .catch((e) => {
        if (alive) setLoadError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2. Load the selected drop's full grid whenever the selection changes.
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDrop(null); // show skeleton while switching
    getLiveDrop(selectedId)
      .then((d) => {
        if (alive) setDrop(d);
      })
      .catch((e) => {
        if (alive) setLoadError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // Refetch just the current grid (after a race-lost hold).
  function refetchGrid() {
    if (!selectedId) return;
    getLiveDrop(selectedId).then(setDrop).catch(() => {});
  }

  const counts = useMemo(() => {
    const units = drop?.units ?? [];
    let avail = 0;
    let held = 0;
    let sold = 0;
    for (const u of units) {
      if (u.status === "available") avail++;
      else if (u.status === "held") held++;
      else sold++;
    }
    const total = units.length || 1;
    return { avail, held, sold, pctLeft: Math.round((avail / total) * 100) };
  }, [drop]);

  const soldOut = drop != null && counts.avail === 0;

  // Reserve a unit, then go to the hold screen. On a race loss, refetch so the
  // grid reflects the unit that just went away.
  async function pick(unitId: string) {
    if (holding) return;
    setHolding(true);
    setHoldError(null);
    try {
      await holdUnit(unitId);
      navigate("/hold");
    } catch (e) {
      const code = apiErrorCode(e);
      setHoldError(holdErrorMessage(code));
      refetchGrid();
    } finally {
      setHolding(false);
    }
  }

  // Reserve the first available unit (CTA shortcut).
  function pickFirstAvailable() {
    const first = drop?.units.find((u) => u.status === "available");
    if (first) pick(first.id);
  }

  // List loaded but empty (or the selected drop is no longer live) → nothing on.
  const noneLive = liveDrops !== null && liveDrops.length === 0;

  if (loadError || noneLive) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader active="drop" />
        <div className="flex flex-1 items-center justify-center px-5">
          <div className="rounded-[5px] border-2 border-destructive bg-white p-5 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">
              {noneLive || loadError === "no_live_drop"
                ? "Aucun drop en cours."
                : "Impossible de charger le drop."}
            </p>
            {loadError && !noneLive && (
              <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {loadError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="drop" live />

      {/* Live-drop switcher — chip row for a handful of drops, searchable bottom
          sheet once there are too many to scan. See DropSwitcher. */}
      {liveDrops && (
        <DropSwitcher
          drops={liveDrops}
          selectedId={selectedId}
          onSelect={(id) => navigate(`/drop/${id}`)}
        />
      )}

      {/* ---- Desktop: 2-column (aside + grid) / Mobile: stacked ---- */}
      <div className="flex flex-1 flex-col md:mx-auto md:grid md:w-full md:max-w-[1440px] md:grid-cols-[400px_1fr] md:gap-8 md:px-8 md:py-7">
        {/* Product + stock + CTA (aside on desktop) */}
        <aside className="flex flex-col gap-4 md:gap-[18px]">
          {/* Product row (compact on mobile) */}
          <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5 md:hidden">
            <div className="h-16 w-16 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
              {drop?.imageUrl ? (
                <img src={drop.imageUrl} alt={`Visuel du drop ${drop.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]">
                  <span className="font-mono text-[8px] text-[#64748B]">photo</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold tracking-[1.5px] text-accent">
                EN COURS
              </div>
              <div className="font-heading text-lg font-bold leading-tight text-[#0F172A]">
                {drop?.name ?? "…"}
              </div>
              <div className="text-[13px] font-bold tabular-nums text-secondary">
                {drop ? `${euros(drop.price)} € · ${drop.units.length} unités` : ""}
              </div>
            </div>
          </div>

          {/* Product hero (desktop) */}
          <div className="hidden h-[300px] overflow-hidden rounded-[5px] border-2 border-[#323232] shadow-[4px_4px_0_#323232] md:block">
            {drop?.imageUrl ? (
              <img src={drop.imageUrl} alt={`Visuel du drop ${drop.name}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_10px,#F2F3F4_10px_20px)]">
                <span className="font-mono text-xs text-[#64748B]">photo produit — {drop?.name ?? "…"}</span>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-extrabold tracking-[2px] text-accent">EN COURS</div>
            <h1 className="mb-1.5 mt-1 font-heading text-[32px] font-extrabold leading-tight text-[#0F172A]">
              {drop?.name ?? "…"}
            </h1>
            <div className="text-[17px] font-bold tabular-nums text-secondary">
              {drop
                ? `${euros(drop.price)} € · ${drop.units.length} unités numérotées, pas une de plus`
                : ""}
            </div>
          </div>

          {/* Stock bar */}
          <div className="px-4 md:px-0">
            <StockBar
              availCount={counts.avail}
              soldCount={counts.sold}
              heldCount={counts.held}
              pctLeft={counts.pctLeft}
            />
          </div>

          {/* Hold error */}
          {holdError && (
            <div className="mx-4 rounded-[5px] border-2 border-destructive bg-white px-3 py-2 text-center text-[13px] font-bold text-destructive md:mx-0">
              {holdError}
            </div>
          )}

          {/* Legend (mobile shows above grid; desktop stays in aside) */}
          <div className="px-4 md:hidden">
            <Legend />
          </div>

          {/* CTA (desktop, in aside) */}
          <button
            type="button"
            disabled={soldOut || holding || !drop}
            onClick={pickFirstAvailable}
            className="hidden h-[60px] items-center justify-center rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-lg font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 md:flex"
          >
            {soldOut
              ? "Tout est vendu"
              : holding
                ? "Réservation…"
                : drop
                  ? `Saisir une unité · ${euros(drop.price)} €`
                  : "Chargement…"}
          </button>
          <p className="hidden text-xs font-semibold text-[#64748B] md:block">
            Une unité choisie est réservée 10 minutes pour toi. Une seule réservation à la fois.
          </p>
          <div className="hidden md:block">
            <Legend />
          </div>
        </aside>

        {/* Unit grid */}
        <div className="px-4 pb-4 md:px-0">
          {!drop ? (
            <div className="grid grid-cols-5 gap-2 md:grid-cols-10 md:gap-2.5">
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-[5px] bg-muted md:h-[54px]" />
              ))}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <UnitGrid units={drop.units} cols="5" onPick={pick} busy={holding} />
              </div>
              <div className="hidden md:block">
                <UnitGrid units={drop.units} cols="10" onPick={pick} busy={holding} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Sticky CTA (mobile only) ---- */}
      <div className="flex-none border-t-2 border-border bg-white px-4 pb-4 pt-3 md:hidden">
        <button
          type="button"
          disabled={soldOut || holding || !drop}
          onClick={pickFirstAvailable}
          className="h-14 w-full rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-[17px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
        >
          {soldOut
            ? "Tout est vendu"
            : holding
              ? "Réservation…"
              : drop
                ? `Saisir une unité · ${euros(drop.price)} €`
                : "Chargement…"}
        </button>
        <p className="mt-2 text-center text-[11px] font-semibold text-[#64748B]">
          Réservée 10 min pour toi, le temps de payer.
        </p>
      </div>
    </div>
  );
}
