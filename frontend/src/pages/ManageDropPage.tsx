import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { apiErrorCode } from "../services/httpClient";
import { getManagedDrop, type ManagedDrop } from "../services/manageDropService";
import { publishDrop } from "../services/createDropService";

// D3 — drop management detail (owner/admin). Shows the live stock breakdown +
// per-state actions. This slice ships the non-destructive actions (Programmer,
// Voir l'aperçu, Rafraîchir); edit / unpublish / delete / suspend are stubbed
// (disabled) pending a later slice. Mirrors public/{liveSession,programmé,
// terminé,brouillon}.jpg.

type DropState = "live" | "scheduled" | "draft" | "soldout";

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function dropAtLabel(iso: string | null): string {
  if (!iso) return "non programmée";
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const date = today
    ? "aujourd'hui"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const time = d
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", " h ");
  return `${date} · ${time}`;
}

function deriveState(d: ManagedDrop): DropState {
  if (d.status === "DRAFT") return "draft";
  if (d.unitCount > 0 && d.sold >= d.unitCount) return "soldout";
  const open = d.dropAt != null && new Date(d.dropAt).getTime() <= Date.now();
  return open ? "live" : "scheduled";
}

const BADGE: Record<DropState, { label: string; className: string; dot?: boolean }> = {
  live: { label: "LIVE", className: "border-[#323232] bg-white text-[#0F172A] shadow-[2px_2px_0_#323232]", dot: true },
  scheduled: { label: "PROGRAMMÉ", className: "border-accent bg-white text-accent" },
  draft: { label: "BROUILLON", className: "border-[#94A3B8] bg-muted text-[#64748B]" },
  soldout: { label: "ÉPUISÉ", className: "border-[#323232] bg-[#323232] text-white" },
};

// One of the three stock cells (DISPO / RÉSERVÉ / VENDU).
function StockCell({ value, label, tone }: { value: number; label: string; tone: "light" | "slate" | "dark" }) {
  const box =
    tone === "light"
      ? "border-[#323232] bg-white text-accent"
      : tone === "slate"
        ? "border-[#323232] bg-[#475569] text-white"
        : "border-[#323232] bg-[#0F172A] text-white";
  return (
    <div className={`flex-1 rounded-[5px] border-2 py-3 text-center ${box}`}>
      <div className="font-mono text-[26px] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[9px] font-extrabold tracking-[1.5px] opacity-80">{label}</div>
    </div>
  );
}

// Action button. `disabled` renders the stubbed (future) actions greyed out.
function ActionBtn({
  label,
  onClick,
  variant,
  disabled,
  title,
}: {
  label: string;
  onClick?: () => void;
  variant: "primary" | "outline" | "dark" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "h-12 w-full rounded-[5px] border-2 border-[#323232] font-heading text-[15px] font-extrabold shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[4px_4px_0_#323232]";
  const tone =
    variant === "primary"
      ? "bg-accent text-white"
      : variant === "dark"
        ? "bg-[#0F172A] text-white"
        : variant === "danger"
          ? "border-destructive bg-white text-destructive"
          : "bg-white text-[#334155]";
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${base} ${tone}`}>
      {label}
    </button>
  );
}

// The action stack, switched on the derived state.
function Actions({ drop, state, onPublish, onRefresh, busy }: {
  drop: ManagedDrop;
  state: DropState;
  onPublish: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const soon = "Bientôt disponible";
  if (state === "live") {
    return (
      <>
        <ActionBtn label={busy ? "…" : "Rafraîchir les ventes"} variant="primary" onClick={onRefresh} disabled={busy} />
        <ActionBtn label="Suspendre la vente" variant="danger" disabled title={soon} />
      </>
    );
  }
  if (state === "scheduled") {
    return (
      <>
        <Link to={`/upcoming/${drop.id}`} className="block">
          <ActionBtn label="Voir l'aperçu de la landing" variant="dark" />
        </Link>
        <ActionBtn label="Éditer dans l'atelier" variant="outline" disabled title={soon} />
        <ActionBtn label="Dépublier (repasser en brouillon)" variant="danger" disabled title={soon} />
      </>
    );
  }
  if (state === "draft") {
    return (
      <>
        <ActionBtn label="Éditer dans l'atelier" variant="outline" disabled title={soon} />
        <ActionBtn label={busy ? "…" : "Programmer le drop"} variant="primary" onClick={onPublish} disabled={busy} />
        <ActionBtn label="Supprimer le brouillon" variant="danger" disabled title={soon} />
      </>
    );
  }
  // soldout
  return <ActionBtn label="Voir le récapitulatif" variant="dark" disabled title={soon} />;
}

export default function ManageDropPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [drop, setDrop] = useState<ManagedDrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDrop(await getManagedDrop(id));
    } catch (e) {
      setError(apiErrorCode(e));
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    getManagedDrop(id)
      .then((d) => alive && setDrop(d))
      .catch((e) => alive && setError(apiErrorCode(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  async function handlePublish() {
    setBusy(true);
    try {
      await publishDrop(id);
      await load();
    } catch (e) {
      setError(apiErrorCode(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    await load();
    setBusy(false);
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader active="create" />
        <div className="flex flex-1 items-center justify-center px-5">
          <div
            role="alert"
            className="w-full max-w-[420px] rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]"
          >
            <p className="text-sm font-bold text-[#0F172A]">
              {error === "not_owner"
                ? "Ce drop n'est pas le tien."
                : error === "not_found"
                ? "Drop introuvable."
                : "Impossible de charger ce drop."}
            </p>
            {error !== "not_owner" && error !== "not_found" && (
              <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
            )}
            <Link to="/my-drops" className="mt-3 inline-block text-sm font-extrabold text-accent">
              ← Mes drops
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AppHeader active="create" />
        <div className="flex flex-1 items-center justify-center px-5">
          <div className="h-64 w-full max-w-[900px] animate-pulse rounded-[5px] border-2 border-border bg-white" />
        </div>
      </div>
    );
  }

  const state = deriveState(drop);
  const badge = BADGE[state];
  const total = drop.unitCount || 1;
  const pct = Math.round((drop.sold / total) * 100);
  const lastSerial = `#${String(drop.unitCount).padStart(3, "0")}`;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="create" />

      <div className="flex flex-1 flex-col gap-6 px-5 py-6 md:mx-auto md:w-full md:max-w-[900px] md:px-12 md:py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/my-drops")}
            aria-label="Retour à Mes drops"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-[13px] font-bold text-secondary">Mes drops</span>
        </div>

        <div className="flex flex-col gap-6 md:grid md:grid-cols-[1fr_320px] md:items-start">
          {/* Left: header + infos */}
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex gap-4">
              <div className="h-24 w-24 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
                {drop.imageUrl ? (
                  <img src={drop.imageUrl} alt={`Visuel du drop ${drop.name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]">
                    <span className="font-mono text-[10px] text-[#94A3B8]">visuel produit</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={`flex w-fit items-center gap-1.5 rounded-[5px] border-2 px-2 py-0.5 text-[11px] font-extrabold tracking-[0.5px] ${badge.className}`}>
                  {badge.dot && <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />}
                  {badge.label}
                </span>
                <h1 className="font-heading text-[24px] font-extrabold leading-tight text-[#0F172A]">
                  {drop.name}
                  {drop.edition ? ` « ${drop.edition} »` : ""}
                </h1>
                <div className="text-[14px] font-bold text-secondary">
                  {euros(drop.price)} € · {drop.unitCount} unités numérotées
                </div>
              </div>
            </div>

            {/* Infos */}
            <div className="flex flex-col gap-0 rounded-[5px] border-2 border-border bg-white text-[14px] font-bold">
              {[
                ["Ouverture", dropAtLabel(drop.dropAt)],
                ["Hold par unité", `${drop.holdMinutes} min`],
                ["Limite / acheteur", String(drop.maxPerBuyer)],
                ["Recette encaissée", `${euros(drop.price * drop.sold)} €`],
              ].map(([k, v], i) => (
                <div key={k} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="text-[#64748B]">{k}</span>
                  <span className={`tabular-nums ${k === "Recette encaissée" ? "text-accent" : "text-[#0F172A]"}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: stock panel + actions */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-heading text-[15px] font-extrabold text-[#0F172A]">État du stock</span>
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  TEMPS RÉEL
                </span>
              </div>
              <div className="flex gap-2">
                <StockCell value={drop.available} label="DISPO" tone="light" />
                <StockCell value={drop.held} label="RÉSERVÉS" tone="slate" />
                <StockCell value={drop.sold} label="VENDUS" tone="dark" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] font-bold">
                <span className="text-[#64748B]">Écoulé</span>
                <span className="tabular-nums text-[#0F172A]">
                  {drop.sold} / {drop.unitCount} · {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-[#323232] bg-white">
                <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
              <span className="mb-1 text-[11px] font-extrabold tracking-[1.5px] text-[#64748B]">ACTIONS</span>
              <Actions drop={drop} state={state} onPublish={handlePublish} onRefresh={handleRefresh} busy={busy} />
            </div>
          </div>
        </div>

        <p className="text-[12px] font-semibold text-[#94A3B8]">
          Édition, dépublication, suspension et suppression arrivent bientôt · {lastSerial} dernière unité.
        </p>
      </div>
    </div>
  );
}
