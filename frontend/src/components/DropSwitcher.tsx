import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveDropSummary } from "../services/dropService";

// Live-drop switcher that scales with how many drops are live at once.
//
//  - up to CHIP_LIMIT drops: a horizontal chip row (fast to scan, zero taps),
//    with edge fades that signal "more to the side" and the active chip auto-
//    scrolled into view.
//  - beyond that: a compact trigger that opens a searchable, sortable bottom
//    sheet — a vertical list beats an endless horizontal scroll on mobile, which
//    is where most users are.
//
// One prop surface either way: the list, the selected id, and an onSelect the
// parent wires to navigation.

const CHIP_LIMIT = 12;

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });
}

export default function DropSwitcher({
  drops,
  selectedId,
  onSelect,
}: {
  drops: LiveDropSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Nothing to switch between: render nothing (parent shows the single drop).
  if (drops.length <= 1) return null;
  return drops.length <= CHIP_LIMIT ? (
    <ChipRow drops={drops} selectedId={selectedId} onSelect={onSelect} />
  ) : (
    <SheetSwitcher drops={drops} selectedId={selectedId} onSelect={onSelect} />
  );
}

// --- Small count (<= CHIP_LIMIT): chip row with edge fades + auto-scroll ---

function ChipRow({
  drops,
  selectedId,
  onSelect,
}: {
  drops: LiveDropSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Center the active chip on mount / when the selection changes, so the user
  // always sees where they are even if it's off-screen to the right.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedId]);

  return (
    <div className="border-b-2 border-border bg-white">
      <div className="relative mx-auto w-full max-w-[1440px]">
        {/* Edge fades — a soft hint that the row scrolls. Non-interactive. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white to-transparent" />
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-2.5 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {drops.map((d) => {
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(d.id)}
                aria-current={active ? "true" : undefined}
                className={`flex flex-none snap-start items-center gap-2 rounded-[5px] border-2 border-[#323232] px-3 py-1.5 text-[13px] font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
                  active
                    ? "bg-[#0F172A] text-white shadow-none"
                    : "bg-white text-[#334155] shadow-[2px_2px_0_#323232]"
                }`}
              >
                <span className="max-w-[160px] truncate">{d.name}</span>
                <span
                  className={`flex-none rounded-[5px] px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums ${
                    active ? "bg-white/15 text-white" : "bg-muted text-accent"
                  }`}
                >
                  {d.availableCount} dispo
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Large count (> CHIP_LIMIT): compact trigger + searchable bottom sheet ---

type Sort = "recent" | "stock";

function SheetSwitcher({
  drops,
  selectedId,
  onSelect,
}: {
  drops: LiveDropSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const searchRef = useRef<HTMLInputElement>(null);

  const current = drops.find((d) => d.id === selectedId) ?? drops[0];

  // Filter by name, then sort. "recent" keeps the server order (most recent
  // first); "stock" surfaces the drops with the most units left.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? drops.filter((d) => d.name.toLowerCase().includes(q))
      : drops;
    if (sort === "stock") {
      return [...filtered].sort((a, b) => b.availableCount - a.availableCount);
    }
    return filtered;
  }, [drops, query, sort]);

  // Lock body scroll + focus the search while the sheet is open; Escape closes.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="border-b-2 border-border bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-2.5 md:px-8">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-[5px] border-2 border-[#323232] bg-white px-3 py-2 text-left shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none md:w-auto"
        >
          <span className="text-[11px] font-extrabold tracking-[1.2px] text-accent">
            DROP ACTUEL
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#0F172A]">
            {current?.name ?? "…"}
          </span>
          <span className="flex-none rounded-[5px] bg-muted px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-accent">
            {drops.length} en cours
          </span>
          <svg
            className="h-4 w-4 flex-none text-[#64748B]"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir un drop en cours"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="lx-sheet-backdrop absolute inset-0 bg-black/50"
          />
          {/* Sheet */}
          <div className="lx-sheet relative flex max-h-[85dvh] flex-col rounded-t-[16px] border-t-2 border-[#323232] bg-background">
            {/* Grabber + header */}
            <div className="flex flex-col gap-3 border-b-2 border-border px-4 pb-3 pt-3">
              <div className="mx-auto h-1 w-10 flex-none rounded-full bg-[#CBD5E1]" />
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[18px] font-extrabold text-[#0F172A]">
                  {drops.length} drops en cours
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[5px] px-2 py-1 text-[13px] font-extrabold text-secondary hover:text-[#0F172A]"
                >
                  Fermer
                </button>
              </div>
              <input
                ref={searchRef}
                type="text"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un drop…"
                className="h-11 w-full rounded-[5px] border-2 border-[#323232] bg-white px-3 text-[15px] font-semibold text-[#0F172A] outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <SortChip active={sort === "recent"} onClick={() => setSort("recent")}>
                  Plus récents
                </SortChip>
                <SortChip active={sort === "stock"} onClick={() => setSort("stock")}>
                  Plus de stock
                </SortChip>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3">
              {shown.length === 0 ? (
                <p className="py-8 text-center text-[14px] font-semibold text-secondary">
                  Aucun drop ne correspond à « {query} ».
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {shown.map((d) => {
                    const active = d.id === selectedId;
                    const soldOut = d.availableCount === 0;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => choose(d.id)}
                          aria-current={active ? "true" : undefined}
                          className={`flex w-full items-center gap-3 rounded-[5px] border-2 p-2.5 text-left transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
                            active
                              ? "border-accent bg-white shadow-[2px_2px_0_#059669]"
                              : "border-[#323232] bg-white shadow-[2px_2px_0_#323232]"
                          }`}
                        >
                          <div className="h-12 w-12 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
                            {d.imageUrl ? (
                              <img
                                src={d.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#E6E8EA_0_6px,#F2F3F4_6px_12px)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-heading text-[15px] font-bold text-[#0F172A]">
                              {d.name}
                            </div>
                            <div className="text-[12px] font-bold tabular-nums text-secondary">
                              {euros(d.price)} € · {d.unitCount} unités
                            </div>
                          </div>
                          <span
                            className={`flex-none rounded-[5px] px-2 py-0.5 text-[12px] font-extrabold tabular-nums ${
                              soldOut
                                ? "bg-[#E2E8F0] text-[#94A3B8]"
                                : "bg-muted text-accent"
                            }`}
                          >
                            {soldOut ? "épuisé" : `${d.availableCount} dispo`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[5px] border-2 px-3 py-1 text-[12px] font-extrabold transition-colors ${
        active
          ? "border-[#323232] bg-[#0F172A] text-white"
          : "border-[#323232] bg-white text-[#334155]"
      }`}
    >
      {children}
    </button>
  );
}
