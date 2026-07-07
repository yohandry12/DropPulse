import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { apiErrorCode } from "../../services/httpClient";
import { displayName } from "../../services/userService";
import {
  getDropEditor,
  patchDrop,
  pauseDrop,
  resumeDrop,
  unpublishDrop,
  publishDrop,
  type DropEditorView,
  type DropEditorPatch,
  type DropDisplayStatus,
  type EditableField,
} from "../../services/dropEditorService";
import { uploadImage, ACCEPTED_IMAGE_TYPES } from "../../services/uploadService";

// A3 — status-aware drop editor. Reached from the Drops table pencil. The set of
// editable fields is DERIVED by the server (view.editableFields) and enforced
// there; the UI only mirrors those locks so a stale client can't overreach.
//   DRAFT / SCHEDULED → everything editable, stock grow-only
//   LIVE / PAUSED     → fiche only (name/edition/desc/image) + grow stock
//   SOLD_OUT          → fiche only, stock locked
// Lifecycle CTA depends on status: LIVE → Suspendre, PAUSED → Réactiver,
// SCHEDULED → Dépublier. Mirrors the "Éditer le drop" maquettes.

const ERROR_MESSAGES: Record<string, string> = {
  field_locked: "Ce champ est verrouillé pour ce statut.",
  edition_locked: "Le stock est verrouillé pour un drop épuisé.",
  cannot_shrink: "Le stock ne peut qu'augmenter.",
  invalid_price: "Prix invalide.",
  invalid_edition_size: "Nombre d'unités invalide (1–100).",
  invalid_max_per_buyer: "Limite par acheteur invalide.",
  invalid_hold_minutes: "Durée de réservation invalide.",
  invalid_duration_days: "Durée de vie invalide (jours entiers ≥ 1).",
  invalid_drop_at: "Date d'ouverture invalide.",
  drop_at_in_past: "La date d'ouverture doit être dans le futur.",
  missing_name: "Le nom est requis.",
  not_published: "Ce drop n'est pas publié.",
  not_scheduled: "Ce drop n'est pas programmé.",
  not_draft: "Ce drop n'est plus un brouillon.",
  unsupported_content_type: "Format d'image non accepté (JPEG, PNG ou WebP).",
  has_sales: "Action impossible : ce drop a des ventes.",
  product_archived: "Ce drop a été retiré.",
  network_error: "Réseau indisponible.",
};

const STATUS_LABEL: Record<DropDisplayStatus, string> = {
  DRAFT: "BROUILLON",
  SCHEDULED: "PROGRAMMÉ",
  PAUSED: "SUSPENDU",
  LIVE: "LIVE",
  SOLD_OUT: "ÉPUISÉ",
};

// Contextual banner copy per status (mirrors the maquette banners).
const BANNER: Record<DropDisplayStatus, { tone: "danger" | "info" | "dark"; text: string }> = {
  LIVE: {
    tone: "danger",
    text: "Drop en cours, les ventes tournent. Prix, calendrier et limite par acheteur sont verrouillés pour ne pas fausser les achats en direct. Tu peux enrichir la fiche produit et augmenter le stock.",
  },
  PAUSED: {
    tone: "danger",
    text: "Drop suspendu — masqué du public, ventes conservées. Réactive-le quand tu veux. Fiche et stock restent modifiables.",
  },
  SCHEDULED: {
    tone: "info",
    text: "Programmé, aucune vente encore. Tu peux tout ajuster librement — attention : changer le nombre d'unités régénère la plage numérotée.",
  },
  DRAFT: {
    tone: "info",
    text: "Brouillon — tout est modifiable. Rien n'est encore publié ; le stock numéroté sera créé au moment de la programmation.",
  },
  SOLD_OUT: {
    tone: "dark",
    text: "Drop épuisé — stock et prix en lecture seule. Tu peux corriger la fiche produit (nom, coloris, description, visuel) pour l'archive et les futures rééditions.",
  },
};

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR");
}

// ISO → the value a <input type="date"> expects (yyyy-mm-dd), local time.
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
// date + time inputs → ISO (or null if date empty). Time defaults to 00:00.
function inputsToIso(date: string, time: string): string | null {
  if (!date) return null;
  const [h, m] = (time || "00:00").split(":");
  const d = new Date(`${date}T${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function serialTail(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

// A lock icon shown next to a disabled field's label.
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[#94A3B8]">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Section shell (01 · PRODUIT etc.).
function Section({ n, title, locked, children }: { n: string; title: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] sm:p-5">
      <p className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[1px] text-[#475569]">
        <span className="text-accent">{n}</span> · {title}
        {locked && <LockIcon />}
      </p>
      {children}
    </div>
  );
}

// Labeled text/number input. Disabled state greys out + shows lock.
function Field({
  label,
  locked,
  children,
}: {
  label: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[12px] font-bold text-[#475569]">
        {label}
        {locked && <LockIcon />}
      </span>
      {children}
    </label>
  );
}

const INPUT =
  "h-11 w-full rounded-[5px] border-2 border-[#323232] bg-white px-3 text-[14px] font-semibold text-[#0F172A] outline-none shadow-[2px_2px_0_#323232] focus:shadow-[1px_1px_0_#323232] disabled:border-[#CBD5E1] disabled:bg-muted disabled:text-[#94A3B8] disabled:shadow-none";

export default function AdminDropEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<DropEditorView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Editable form state — hydrated from the view, then diffed on save.
  const [name, setName] = useState("");
  const [edition, setEdition] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); // euros string
  const [editionSize, setEditionSize] = useState("");
  const [maxPerBuyer, setMaxPerBuyer] = useState("");
  const [dropDate, setDropDate] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [holdMinutes, setHoldMinutes] = useState(10);
  const [durationStr, setDurationStr] = useState(""); // days of life; "" = indefinite
  // Pending image replacement: key + preview URL set after a successful upload,
  // cleared on hydrate (the fresh view carries the saved image).
  const [newImageKey, setNewImageKey] = useState<string | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function hydrate(v: DropEditorView) {
    setView(v);
    setName(v.name);
    setEdition(v.edition ?? "");
    setDescription(v.description ?? "");
    setPrice(String(Math.round(v.price / 100)));
    setEditionSize(String(v.unitCount));
    setMaxPerBuyer(String(v.maxPerBuyer));
    setDropDate(isoToDateInput(v.dropAt));
    setDropTime(isoToTimeInput(v.dropAt));
    setHoldMinutes(v.holdMinutes);
    setDurationStr(v.durationDays != null ? String(v.durationDays) : "");
    setNewImageKey(null);
    setNewImagePreview(null);
  }

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getDropEditor(id)
      .then((v) => {
        if (alive) hydrate(v);
      })
      .catch((e) => {
        if (alive) setLoadError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const locked = (f: EditableField): boolean =>
    view ? !view.editableFields.includes(f) : true;

  // Build the patch from whatever actually changed AND is unlocked. editionSize
  // only when grow-able and increased.
  const patch = useMemo<DropEditorPatch>(() => {
    if (!view) return {};
    const p: DropEditorPatch = {};
    if (!locked("name") && name.trim() !== view.name) p.name = name.trim();
    if (!locked("edition") && (edition.trim() || null) !== (view.edition ?? null))
      p.edition = edition.trim() || null;
    if (!locked("description") && (description.trim() || null) !== (view.description ?? null))
      p.description = description.trim() || null;
    if (!locked("price")) {
      const cents = Math.round(Number(price) * 100);
      if (Number.isFinite(cents) && cents !== view.price) p.price = cents;
    }
    if (!locked("maxPerBuyer")) {
      const n = Number(maxPerBuyer);
      if (Number.isInteger(n) && n !== view.maxPerBuyer) p.maxPerBuyer = n;
    }
    if (!locked("dropAt")) {
      const iso = inputsToIso(dropDate, dropTime);
      if (iso !== view.dropAt) p.dropAt = iso;
    }
    if (!locked("holdMinutes") && holdMinutes !== view.holdMinutes) p.holdMinutes = holdMinutes;
    if (!locked("durationDays")) {
      const next = durationStr.trim() === "" ? null : Number(durationStr);
      const clean = next != null && Number.isInteger(next) && next >= 1 ? next : null;
      if (clean !== view.durationDays) p.durationDays = clean;
    }
    if (!locked("imageKey") && newImageKey && newImageKey !== view.imageKey) p.imageKey = newImageKey;
    if (view.canGrowEdition) {
      const n = Number(editionSize);
      if (Number.isInteger(n) && n > view.unitCount) p.editionSize = n;
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, name, edition, description, price, maxPerBuyer, dropDate, dropTime, holdMinutes, durationStr, editionSize, newImageKey]);

  const dirty = Object.keys(patch).length > 0;

  function reportError(e: unknown) {
    const code = apiErrorCode(e);
    setActionError(ERROR_MESSAGES[code] ?? `Erreur : ${code}`);
  }

  async function handleSave() {
    if (!id || !dirty || busy) return;
    setActionError(null);
    setBusy(true);
    try {
      const fresh = await patchDrop(id, patch);
      hydrate(fresh);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  // Lifecycle actions (pause / resume / unpublish) then refetch the view.
  async function runLifecycle(fn: (id: string) => Promise<void>) {
    if (!id || busy) return;
    setActionError(null);
    setBusy(true);
    try {
      await fn(id);
      const fresh = await getDropEditor(id);
      hydrate(fresh);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  // Replace the product visual: upload to MinIO now, stage the key — it only
  // lands on the drop when the admin saves (Enregistrer).
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || uploading) return;
    setActionError(null);
    setUploading(true);
    try {
      const { key, publicUrl } = await uploadImage(file);
      setNewImageKey(key);
      setNewImagePreview(publicUrl);
    } catch (err) {
      reportError(err);
    } finally {
      setUploading(false);
    }
  }

  // DRAFT → SCHEDULED. Saves any pending edits first (the dropAt set in section
  // 03 defines whether it's "programmé" or opens as soon as a date exists).
  async function handlePublish() {
    if (!id || busy) return;
    setActionError(null);
    setBusy(true);
    try {
      if (dirty) await patchDrop(id, patch);
      await publishDrop(id);
      const fresh = await getDropEditor(id);
      hydrate(fresh);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <AdminLayout active="drops">
        <div className="rounded-[5px] border-2 border-destructive bg-white p-6 text-center shadow-[4px_4px_0_#DC2626]">
          <p className="text-sm font-bold text-[#0F172A]">
            {loadError === "product_not_found" ? "Ce drop n'existe pas." : "Impossible de charger le drop."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/drops")}
            className="mt-3 text-[13px] font-extrabold text-accent"
          >
            ← Retour aux drops
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!view) {
    return (
      <AdminLayout active="drops">
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" />
        </div>
      </AdminLayout>
    );
  }

  const status = view.displayStatus;
  const banner = BANNER[status];
  const bannerCls =
    banner.tone === "danger"
      ? "border-destructive bg-[#FEE2E2] text-[#0F172A]"
      : banner.tone === "dark"
        ? "border-[#323232] bg-[#0F172A] text-white"
        : "border-primary bg-[#EEF2FF] text-[#0F172A]";
  const recette = view.sold * view.price; // encaissé (or max when nothing sold yet)
  const hasSales = view.sold > 0;

  return (
    <AdminLayout active="drops">
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin/drops")}
          aria-label="Retour aux drops"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 font-heading text-[24px] font-extrabold leading-none text-[#0F172A] md:text-[28px]">
            Éditer le drop <span className="text-accent">#{view.id.slice(0, 6)}</span>
            <StatusPill status={status} />
          </h1>
          <p className="mt-1.5 text-[12px] font-semibold text-secondary">
            {view.creator ? `Créé par ${displayName(view.creator)}` : "Créateur inconnu"}
          </p>
        </div>
      </div>

      {/* Contextual banner */}
      <div className={`mb-5 flex items-start gap-2.5 rounded-[5px] border-2 p-3.5 ${bannerCls}`}>
        <span className={`mt-0.5 flex-none ${banner.tone === "dark" ? "text-white" : banner.tone === "danger" ? "text-destructive" : "text-primary"}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <p className="text-[13px] font-semibold leading-snug">{banner.text}</p>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-[5px] border-2 border-destructive bg-white p-3 text-[13px] font-bold text-[#0F172A] shadow-[3px_3px_0_#DC2626]">
          {actionError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left: form sections */}
        <div className="flex flex-col gap-5">
          <Section n="01" title="Produit">
            <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
              {/* Visual: current image (or pending replacement), + replace button. */}
              <div>
                <span className="mb-1 flex items-center gap-1 text-[12px] font-bold text-[#475569]">
                  Visuel produit
                  {locked("imageKey") && <LockIcon />}
                </span>
                <div className="h-[110px] overflow-hidden rounded-[5px] border-2 border-[#323232]">
                  {newImagePreview || view.imageUrl ? (
                    <img
                      src={newImagePreview ?? view.imageUrl ?? undefined}
                      alt={`Visuel du drop ${view.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_10px,#F2F3F4_10px_20px)]">
                      <span className="font-mono text-[10px] text-[#64748B]">aucun visuel</span>
                    </div>
                  )}
                </div>
                <label
                  className={`mt-2 flex h-9 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[12px] font-bold text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                    locked("imageKey") || uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  }`}
                >
                  {uploading ? "Envoi…" : "Remplacer le visuel"}
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    onChange={handleFile}
                    disabled={locked("imageKey") || uploading}
                    className="hidden"
                  />
                </label>
                {newImageKey && (
                  <p className="mt-1.5 text-[11px] font-bold text-accent">
                    Nouveau visuel prêt — enregistre pour l'appliquer.
                  </p>
                )}
              </div>

              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nom du modèle" locked={locked("name")}>
                    <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} disabled={locked("name")} />
                  </Field>
                  <Field label="Édition / coloris" locked={locked("edition")}>
                    <input className={INPUT} value={edition} onChange={(e) => setEdition(e.target.value)} disabled={locked("edition")} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Description (optionnel)" locked={locked("description")}>
                    <textarea
                      className={`${INPUT} h-auto min-h-[72px] py-2`}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={locked("description")}
                      rows={2}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Section>

          <Section n="02" title="Stock & prix">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Prix unitaire (€)" locked={locked("price")}>
                <input className={INPUT} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} disabled={locked("price")} />
              </Field>
              <Field label="Nombre d'unités" locked={!view.canGrowEdition}>
                <input
                  className={INPUT}
                  type="number"
                  min={view.unitCount}
                  value={editionSize}
                  onChange={(e) => setEditionSize(e.target.value)}
                  disabled={!view.canGrowEdition}
                />
              </Field>
              <Field label="Limite / acheteur" locked={locked("maxPerBuyer")}>
                <input className={INPUT} type="number" min={1} value={maxPerBuyer} onChange={(e) => setMaxPerBuyer(e.target.value)} disabled={locked("maxPerBuyer")} />
              </Field>
            </div>
            {view.canGrowEdition && (
              <p className="mt-2.5 text-[12px] font-semibold text-accent">
                {status === "DRAFT"
                  ? `Plage : ${serialTail(1)}→${serialTail(Number(editionSize) || view.unitCount)}.`
                  : `Tu peux seulement augmenter le stock (≥ ${view.unitCount}). Les nouvelles unités seront ${serialTail(view.unitCount + 1)} et suivantes.`}
              </p>
            )}
          </Section>

          <Section n="03" title="Ouverture & réservation" locked={locked("dropAt")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date d'ouverture" locked={locked("dropAt")}>
                <input className={INPUT} type="date" min={isoToDateInput(new Date().toISOString())} value={dropDate} onChange={(e) => setDropDate(e.target.value)} disabled={locked("dropAt")} />
              </Field>
              <Field label="Heure d'ouverture" locked={locked("dropAt")}>
                <input className={INPUT} type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} disabled={locked("dropAt")} />
              </Field>
            </div>
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-[#475569]">
                Durée de réservation (hold)
                {locked("holdMinutes") && <LockIcon />}
              </p>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => !locked("holdMinutes") && setHoldMinutes(m)}
                    disabled={locked("holdMinutes")}
                    className={`h-10 flex-1 rounded-[5px] border-2 text-[13px] font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed ${
                      holdMinutes === m
                        ? "border-[#323232] bg-accent text-white shadow-none"
                        : "border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232] disabled:border-[#CBD5E1] disabled:bg-muted disabled:text-[#94A3B8] disabled:shadow-none"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Field label="Durée de vie (jours) — optionnel" locked={locked("durationDays")}>
                <input
                  className={`${INPUT} max-w-[200px]`}
                  type="number"
                  min={1}
                  value={durationStr}
                  onChange={(e) => setDurationStr(e.target.value)}
                  disabled={locked("durationDays")}
                  placeholder="ex : 7 — vide = indéfini"
                />
              </Field>
              {view.dropAt && durationStr.trim() !== "" && Number(durationStr) >= 1 && (
                <p className="mt-1.5 text-[12px] font-semibold text-secondary">
                  Expire le{" "}
                  <span className="font-bold text-[#0F172A]">
                    {new Date(new Date(view.dropAt).getTime() + Number(durationStr) * 86_400_000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>{" "}
                  s'il n'est pas épuisé — suspendu automatiquement.
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* Right: landing preview + stats */}
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[1px] text-[#475569]">
            Aperçu de la landing <StatusPill status={status} small />
          </p>
          <div className="rounded-[5px] border-2 border-[#323232] bg-[#0F172A] p-4 shadow-[4px_4px_0_#323232]">
            <div className="mb-3 h-24 overflow-hidden rounded-[5px] border border-[#334155]">
              {newImagePreview || view.imageUrl ? (
                <img
                  src={newImagePreview ?? view.imageUrl ?? undefined}
                  alt={`Visuel du drop ${view.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#1E293B_0_10px,#0F172A_10px_20px)]">
                  <span className="font-mono text-[11px] text-[#64748B]">visuel produit</span>
                </div>
              )}
            </div>
            <p className="text-[10px] font-extrabold tracking-[1.5px] text-accent">
              {status === "LIVE" ? `DROP #${view.id.slice(0, 6)} · EN COURS` : status === "SOLD_OUT" ? `DROP #${view.id.slice(0, 6)} · TERMINÉ` : "APERÇU"}
            </p>
            <h3 className="mt-1 font-heading text-[20px] font-extrabold text-white">{name || "—"}</h3>
            <p className="mt-0.5 text-[12px] font-semibold text-[#94A3B8]">
              « {edition || "—"} » · {view.unitCount} unités numérotées · {euros(view.price)} €
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <PreviewStat value={view.available} label="DISPO" tone="white" />
              <PreviewStat value={view.held} label="RÉSA" tone="dark" />
              <PreviewStat value={view.sold} label="VENDU" tone="accent" />
            </div>

            <div className="mt-3 h-11 rounded-[5px] border-2 border-[#323232] bg-accent text-center font-heading text-[14px] font-extrabold leading-[2.6] text-white">
              {status === "SOLD_OUT" ? "Sold out" : status === "LIVE" ? "Saisir une unité" : "Rejoindre le drop"}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232]">
            <StatRow label="Plage d'unités" value={`${serialTail(1)}→${serialTail(view.unitCount)}`} />
            <StatRow label={hasSales ? "Recette encaissée" : "Recette max"} value={`${euros(hasSales ? recette : view.unitCount * view.price)} €`} />
            <StatRow label="Hold par unité" value={`${view.holdMinutes} min`} last />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t-2 border-border pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || busy}
          className="h-11 rounded-[5px] border-2 border-[#323232] bg-accent px-5 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-[#94A3B8] disabled:shadow-none"
        >
          {busy ? "Enregistrement…" : savedFlash ? "Enregistré ✓" : "Enregistrer les modifications"}
        </button>

        {/* Lifecycle CTA by status */}
        {status === "DRAFT" && (
          <LifecycleButton
            label={busy ? "Publication…" : dropDate ? "Programmer le drop" : "Publier le drop"}
            onClick={handlePublish}
            busy={busy}
            tone="accent"
          />
        )}
        {status === "LIVE" && (
          <LifecycleButton label="Suspendre le drop" onClick={() => runLifecycle(pauseDrop)} busy={busy} />
        )}
        {status === "PAUSED" && (
          <LifecycleButton label="Réactiver le drop" onClick={() => runLifecycle(resumeDrop)} busy={busy} tone="accent" />
        )}
        {status === "SCHEDULED" && (
          <LifecycleButton label="Dépublier" onClick={() => runLifecycle(unpublishDrop)} busy={busy} />
        )}

        <button
          type="button"
          onClick={() => navigate("/admin/drops")}
          className="ml-auto text-[13px] font-extrabold text-secondary hover:text-[#0F172A]"
        >
          Annuler
        </button>
      </div>
    </AdminLayout>
  );
}

function StatusPill({ status, small }: { status: DropDisplayStatus; small?: boolean }) {
  const cls =
    status === "LIVE"
      ? "border-destructive bg-white text-destructive"
      : status === "PAUSED"
        ? "border-[#D97706] bg-[#FEF3C7] text-[#B45309]"
        : status === "SOLD_OUT"
          ? "border-[#323232] bg-[#0F172A] text-white"
          : status === "SCHEDULED"
            ? "border-primary bg-white text-primary"
            : "border-[#CBD5E1] bg-muted text-[#475569]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-[5px] border-2 px-2 py-0.5 font-extrabold tracking-[0.5px] ${cls} ${small ? "text-[9px]" : "text-[10px]"}`}>
      {status === "LIVE" && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function PreviewStat({ value, label, tone }: { value: number; label: string; tone: "white" | "dark" | "accent" }) {
  const cls =
    tone === "accent"
      ? "bg-accent text-white"
      : tone === "dark"
        ? "bg-[#1E293B] text-white"
        : "bg-white text-[#0F172A]";
  return (
    <div className={`rounded-[5px] border-2 border-[#323232] py-2 text-center ${cls}`}>
      <p className="text-[20px] font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[9px] font-extrabold tracking-[1px] opacity-80">{label}</p>
    </div>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-border"}`}>
      <span className="text-[12px] font-semibold text-secondary">{label}</span>
      <span className="text-[13px] font-extrabold tabular-nums text-[#0F172A]">{value}</span>
    </div>
  );
}

function LifecycleButton({ label, onClick, busy, tone }: { label: string; onClick: () => void; busy: boolean; tone?: "accent" }) {
  const cls =
    tone === "accent"
      ? "border-[#323232] bg-accent text-white shadow-[3px_3px_0_#323232]"
      : "border-destructive bg-white text-destructive shadow-[3px_3px_0_#DC2626]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`h-11 rounded-[5px] border-2 px-5 font-heading text-[14px] font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
