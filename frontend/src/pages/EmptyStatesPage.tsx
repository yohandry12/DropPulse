import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useCountdown } from "../hooks/useCountdown";

// "États vides / échec" screen (maquette 1f). Two states:
//  - soldout: the current drop is 100/100 gone
//  - none:    no drop is live right now, next one is counting down
// Light neobrutalist palette, matching the drop pages. A small toggle switches
// between them (these are showcase states, like the hold screen's variants).

type EmptyView = "soldout" | "none";

// 100 sold cells for the sold-out grid.
const SOLD_CELLS = Array.from({ length: 100 }, (_, i) => i);

function SoldOutView({ nextDropMs }: { nextDropMs: number }) {
  const navigate = useNavigate();
  const cd = useCountdown(nextDropMs);

  return (
    <div className="flex flex-1 flex-col gap-[18px] px-5 py-6 md:mx-auto md:w-full md:max-w-[480px]">
      <div className="text-center">
        <div className="inline-block rounded-[5px] border-2 border-[#323232] bg-[#0F172A] px-3.5 py-1.5 font-heading text-sm font-extrabold tracking-[2px] text-background shadow-[4px_4px_0_#323232]">
          SOLD OUT
        </div>
        <h2 className="mb-1.5 mt-4 font-heading text-[32px] font-extrabold leading-[1.05] text-[#0F172A]">
          Tout est parti.
        </h2>
        <p className="text-sm font-bold text-secondary">
          <span className="font-mono">100/100</span> vendues en{" "}
          <span className="font-mono">7 min 42 s</span>.
        </p>
      </div>

      {/* Sold-out grid — all cells greyed */}
      <div className="grid grid-cols-10 gap-1 rounded-[5px] border-2 border-border bg-white p-3.5">
        {SOLD_CELLS.map((i) => (
          <div key={i} className="h-4 rounded-[3px] bg-[#E2E8F0]" />
        ))}
      </div>

      {/* Next drop teaser */}
      <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 text-center shadow-[4px_4px_0_#323232]">
        <div className="text-[11px] font-extrabold tracking-[2px] text-accent">
          PROCHAIN DROP · #08
        </div>
        <div className="mt-1 font-mono text-[34px] font-bold tabular-nums text-[#0F172A]">
          {cd.hours} h {cd.minutes} min
        </div>
        <p className="mt-1.5 text-xs font-bold text-[#64748B]">Même heure, autre paire. Sois prêt.</p>
      </div>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => navigate("/upcoming")}
          className="h-14 w-full rounded-[5px] border-2 border-[#323232] bg-accent font-sans text-[17px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          M'alerter pour le drop #08
        </button>
      </div>
    </div>
  );
}

function NoDropView({ nextDropMs }: { nextDropMs: number }) {
  const navigate = useNavigate();
  const cd = useCountdown(nextDropMs);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-6 text-center md:mx-auto md:w-full md:max-w-[480px]">
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232]">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#334155"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      </div>
      <h2 className="font-heading text-[28px] font-extrabold text-[#0F172A]">Aucun drop en cours.</h2>
      <p className="text-sm font-bold text-secondary">
        Le prochain ouvre dans{" "}
        <span className="font-mono text-accent">
          {cd.hours} h {cd.minutes} min
        </span>
        . C'est le moment de préparer ta carte.
      </p>
      <button
        type="button"
        onClick={() => navigate("/upcoming")}
        className="h-12 rounded-[5px] border-2 border-[#323232] bg-white px-6 font-sans text-[15px] font-extrabold text-[#0F172A] shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Voir le drop à venir
      </button>
    </div>
  );
}

export default function EmptyStatesPage() {
  const [view, setView] = useState<EmptyView>("soldout");
  // Next drop targets — fixed offsets from mount so the countdowns tick.
  const soldOutTarget = useMemo(() => Date.now() + 26 * 3600_000 + 4 * 60_000, []);
  const noneTarget = useMemo(() => Date.now() + 8 * 3600_000 + 12 * 60_000, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="drop" />

      {/* Showcase toggle (these are demo states of the same slot) */}
      <div className="flex justify-center gap-2 border-b-2 border-border bg-white py-2.5">
        {(["soldout", "none"] as EmptyView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-[5px] border-2 px-3 py-1 text-xs font-extrabold transition-colors ${
              view === v
                ? "border-[#323232] bg-[#0F172A] text-white"
                : "border-border bg-white text-[#64748B] hover:border-[#94A3B8]"
            }`}
          >
            {v === "soldout" ? "Drop terminé" : "Aucun drop"}
          </button>
        ))}
      </div>

      {view === "soldout" ? (
        <SoldOutView nextDropMs={soldOutTarget} />
      ) : (
        <NoDropView nextDropMs={noneTarget} />
      )}
    </div>
  );
}
