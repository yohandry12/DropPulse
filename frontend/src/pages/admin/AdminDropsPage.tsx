import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { apiErrorCode } from "../../services/httpClient";
import { displayName } from "../../services/userService";
import {
  getProducts,
  archiveProduct,
  deriveDropStatus,
  type AdminProduct,
  type DropDisplayStatus,
} from "../../services/adminProductsService";

// A3 — drop management. Table of ALL drops across the platform (every dropper):
// short id + relative date + price, creator, derived status, serial range, sold-
// through bar. Per-row actions (hover-revealed on desktop, always visible on
// mobile): edit (pencil → "Mettre à jour" modal → opens the drop editor) and
// archive (trash → "Retirer le drop" modal, soft-delete). Archiving is refused
// server-side when any unit is sold. Filter by status (Tous / Live / Programmés /
// Brouillons / Épuisés). Mirrors DESIGN_BRIEF_ADMIN A3 + Drops maquettes.

const STATUS_FILTERS: { key: "ALL" | DropDisplayStatus; label: string }[] = [
  { key: "ALL", label: "Tous" },
  { key: "LIVE", label: "Live" },
  { key: "PAUSED", label: "Suspendus" },
  { key: "SCHEDULED", label: "Programmés" },
  { key: "DRAFT", label: "Brouillons" },
  { key: "SOLD_OUT", label: "Épuisés" },
];

const ERROR_MESSAGES: Record<string, string> = {
  has_sales: "Impossible de retirer : ce drop a déjà des ventes.",
  product_not_found: "Drop introuvable.",
  network_error: "Réseau indisponible.",
};

// Short public id shown in the DROP column (#a1b2c3).
function shortId(id: string): string {
  return `#${id.slice(0, 6)}`;
}

// Price in euros from cents.
function priceLabel(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR")} €`;
}

// dropAt as a friendly relative-ish label. Today → "aujourd'hui"; otherwise the
// short date. Null (no schedule) → "—".
function dropAtLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "aujourd'hui";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// Serial range "#001→#080" from first/last serials. Serials share a per-drop
// prefix (prefix-0001); we show the numeric tail only.
function rangeLabel(first: string | null, last: string | null): string {
  if (!first || !last) return "—";
  const tail = (s: string) => `#${s.split("-").pop() ?? s}`;
  return `${tail(first)}→${tail(last)}`;
}

// Status pill — dot + label. LIVE red, SCHEDULED indigo outline, DRAFT muted,
// SOLD_OUT dark filled.
function StatusPill({ status }: { status: DropDisplayStatus }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[5px] border-2 border-destructive bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        LIVE
      </span>
    );
  }
  if (status === "PAUSED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[5px] border-2 border-[#D97706] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-[#B45309]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
        SUSPENDU
      </span>
    );
  }
  if (status === "SCHEDULED") {
    return (
      <span className="inline-flex items-center rounded-[5px] border-2 border-primary bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-primary">
        PROGRAMMÉ
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center rounded-[5px] border-2 border-[#CBD5E1] bg-muted px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-[#475569]">
        BROUILLON
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[5px] border-2 border-[#323232] bg-[#0F172A] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-white">
      ÉPUISÉ
    </span>
  );
}

// Sold-through bar + "sold/total" caption. Full accent when sold out.
function SoldBar({ sold, total }: { sold: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  return (
    <div className="min-w-[90px]">
      <p className="text-[12px] font-extrabold tabular-nums text-[#0F172A]">
        {sold}/{total}
      </p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-[#CBD5E1] bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Shared modal shell (same neobrutalist shell as A2 users).
function Modal({
  onClose,
  busy,
  children,
}: {
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/45 px-4 pb-4 sm:items-center sm:pb-0"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[5px] border-2 border-[#323232] bg-white p-5 shadow-[6px_6px_0_#323232] sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}

// "Mettre à jour le drop" — confirms opening the editor (carries the drop id).
function UpdateModal({
  product,
  onConfirm,
  onClose,
}: {
  product: AdminProduct;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} busy={false}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-[#323232] bg-muted text-[18px] font-extrabold text-[#334155]">
          !
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold text-[#0F172A]">Mettre à jour le drop</h2>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[#475569]">
            Modifier <span className="font-extrabold text-[#0F172A]">« {product.name} »</span> ouvre l'éditeur de drop.
            Continuer ?
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-white px-4 text-[14px] font-bold text-[#334155] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-accent px-4 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          Ouvrir l'éditeur
        </button>
      </div>
    </Modal>
  );
}

// "Retirer le drop" — soft-delete (archive). Warns that unsold units become
// unavailable. The confirm is destructive-styled but not gated by a checkbox
// (archiving is reversible in spirit — the row survives).
function ArchiveModal({
  product,
  busy,
  onConfirm,
  onClose,
}: {
  product: AdminProduct;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} busy={busy}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-destructive bg-[#FEE2E2] text-[18px] font-extrabold text-destructive">
          !
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold text-[#0F172A]">Retirer le drop</h2>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[#475569]">
            <span className="font-extrabold text-[#0F172A]">« {product.name} »</span> sera retiré de la plateforme.
            Les unités non vendues ne seront plus accessibles.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-white px-4 text-[14px] font-bold text-[#334155] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-destructive px-4 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Retrait…" : "Retirer"}
        </button>
      </div>
    </Modal>
  );
}

// Per-row actions: pencil (edit → editor) + trash (archive).
function RowActions({
  busy,
  onEdit,
  onArchive,
}: {
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        aria-label="Mettre à jour le drop"
        title="Mettre à jour"
        className="flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onArchive}
        disabled={busy}
        aria-label="Retirer le drop"
        title="Retirer"
        className="flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-destructive bg-white text-destructive shadow-[2px_2px_0_#DC2626] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

// Creator label: display name, or "—" for legacy seeded drops (null creator).
function creatorLabel(p: AdminProduct): string {
  return p.creator ? displayName(p.creator) : "—";
}

export default function AdminDropsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | DropDisplayStatus>("ALL");

  function load() {
    getProducts()
      .then(setProducts)
      .catch((e) => setError(apiErrorCode(e)));
  }

  // Refetch whenever we land on the list — a status change made in the editor
  // (suspendre/réactiver/publier) must be reflected here, not served from stale
  // mount-time cache.
  useEffect(() => {
    if (pathname === "/admin/drops") load();
  }, [pathname]);

  // Archived drops drop off the admin table (they're soft-deleted). We could show
  // them flagged, but the maquette lists active drops only — keep it clean.
  const active = useMemo(
    () => (products ? products.filter((p) => p.archivedAt == null) : []),
    [products],
  );

  const visible = useMemo(() => {
    if (statusFilter === "ALL") return active;
    return active.filter((p) => deriveDropStatus(p) === statusFilter);
  }, [active, statusFilter]);

  function reportError(e: unknown) {
    const code = apiErrorCode(e);
    setActionError(ERROR_MESSAGES[code] ?? `Erreur : ${code}`);
  }

  async function handleArchive(p: AdminProduct) {
    if (busyId) return;
    setActionError(null);
    setBusyId(p.id);
    try {
      await archiveProduct(p.id);
      // Drop it from the list in place — no refetch.
      setProducts((prev) => (prev ? prev.filter((x) => x.id !== p.id) : prev));
      setArchiveTarget(null);
    } catch (e) {
      reportError(e);
      setArchiveTarget(null); // close so the error banner is visible
    } finally {
      setBusyId(null);
    }
  }

  // Pencil → open the drop editor (placeholder route until the editor slice).
  function openEditor(p: AdminProduct) {
    navigate(`/admin/drops/${p.id}/edit`);
  }

  const total = active.length;

  return (
    <AdminLayout active="drops">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[26px] font-extrabold leading-none text-[#0F172A] md:text-[30px]">
            Drops <span className="text-[15px] font-bold text-secondary">· toute la plateforme</span>
          </h1>
          <p className="mt-1.5 text-[13px] font-bold text-secondary">
            {visible.length} / {total} drop{total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/create")}
          className="flex-none rounded-[5px] border-2 border-[#323232] bg-accent px-4 py-2.5 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          + Créer un drop
        </button>
      </div>

      {/* Status filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`h-9 rounded-[5px] border-2 border-[#323232] px-3 text-[13px] font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
              statusFilter === f.key
                ? "bg-[#0F172A] text-white shadow-none"
                : "bg-white text-[#334155] shadow-[2px_2px_0_#323232]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-[5px] border-2 border-destructive bg-white p-3 text-[13px] font-bold text-[#0F172A] shadow-[3px_3px_0_#DC2626]">
          {actionError}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
          <p className="text-sm font-bold text-[#0F172A]">Impossible de charger les drops.</p>
          <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
        </div>
      )}

      {!products && !error && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[5px] border-2 border-border bg-white" />
          ))}
        </div>
      )}

      {products && visible.length === 0 && !error && (
        <div className="rounded-[5px] border-2 border-dashed border-[#94A3B8] bg-white p-10 text-center">
          <p className="font-heading text-[18px] font-extrabold text-[#0F172A]">Aucun drop.</p>
          <p className="mt-1 text-[13px] font-bold text-secondary">
            {total === 0 ? "La plateforme n'a pas encore de drop." : "Aucun drop pour ce filtre."}
          </p>
        </div>
      )}

      {products && visible.length > 0 && (
        <>
          {/* Desktop table — actions hover-revealed per row */}
          <div className="hidden overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232] md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-[#323232] bg-muted text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#475569]">
                  <th className="px-4 py-3">Drop</th>
                  <th className="px-4 py-3">Créateur</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Plage</th>
                  <th className="px-4 py-3">Écoulé</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="group border-b border-border last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-bold text-[#0F172A]">
                        <span className="text-accent">{shortId(p.id)}</span> {p.name}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-secondary">
                        {dropAtLabel(p.dropAt)} · {priceLabel(p.price)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#334155]">{creatorLabel(p)}</td>
                    <td className="px-4 py-3"><StatusPill status={deriveDropStatus(p)} /></td>
                    <td className="px-4 py-3 text-[13px] font-bold tabular-nums text-secondary">
                      {rangeLabel(p.firstSerial, p.lastSerial)}
                    </td>
                    <td className="px-4 py-3"><SoldBar sold={p.soldCount} total={p.unitCount} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end transition-opacity opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                        <RowActions
                          busy={busyId === p.id}
                          onEdit={() => {
                            setActionError(null);
                            setEditTarget(p);
                          }}
                          onArchive={() => {
                            setActionError(null);
                            setArchiveTarget(p);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — actions always visible */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((p) => (
              <div key={p.id} className="rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#0F172A]">
                      <span className="text-accent">{shortId(p.id)}</span> {p.name}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-secondary">
                      {creatorLabel(p)} · {rangeLabel(p.firstSerial, p.lastSerial)} · {dropAtLabel(p.dropAt)}
                    </p>
                  </div>
                  <StatusPill status={deriveDropStatus(p)} />
                </div>
                <div className="mt-3">
                  <SoldBar sold={p.soldCount} total={p.unitCount} />
                </div>
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setEditTarget(p);
                    }}
                    disabled={busyId === p.id}
                    className="h-10 flex-1 rounded-[5px] border-2 border-[#323232] bg-white text-[13px] font-bold text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
                  >
                    Mettre à jour
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setArchiveTarget(p);
                    }}
                    disabled={busyId === p.id}
                    className="h-10 flex-1 rounded-[5px] border-2 border-destructive bg-white text-[13px] font-bold text-destructive shadow-[2px_2px_0_#DC2626] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editTarget && (
        <UpdateModal
          product={editTarget}
          onConfirm={() => {
            const p = editTarget;
            setEditTarget(null);
            openEditor(p);
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {archiveTarget && (
        <ArchiveModal
          product={archiveTarget}
          busy={busyId === archiveTarget.id}
          onConfirm={() => handleArchive(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
