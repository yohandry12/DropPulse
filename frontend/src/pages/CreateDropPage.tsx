import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useCountdown } from "../hooks/useCountdown";
import { apiErrorCode } from "../services/httpClient";
import { getPayoutStatus } from "../services/payoutService";
import {
  createDrop,
  publishDrop,
  type CreateDropPayload,
} from "../services/createDropService";
import {
  ACCEPTED_IMAGE_TYPES,
  uploadImage,
} from "../services/uploadService";

// D1 — "Créer un drop". Two-column on desktop: form (left) + live landing
// preview (right) that updates as you type. On mobile the preview stacks on top.
// Two submit paths: save draft (POST /products, stays DRAFT) or schedule
// (create then publish → SCHEDULED). Mirrors public/Creer un drop.pdf.

const HOLD_OPTIONS = [5, 10, 15, 20];

const ERROR_MESSAGES: Record<string, string> = {
  missing_name: "Le nom du modèle est requis.",
  invalid_price: "Prix invalide.",
  invalid_edition_size: "Nombre d'unités invalide (1 à 100).",
  invalid_max_per_buyer: "Limite par acheteur invalide.",
  invalid_hold_minutes: "Durée de hold invalide.",
  invalid_drop_at: "Date ou heure d'ouverture invalide.",
  drop_at_in_past: "La date d'ouverture doit être dans le futur.",
  unsupported_content_type: "Format d'image non supporté (JPG, PNG, WebP).",
  insufficient_role: "Vous n'avez pas les droits pour créer un drop.",
  network_error: "Serveur injoignable. Réessayez.",
};

// Shared input styling (slate border + hard shadow), matching LoginPage.
const INPUT =
  "h-11 w-full rounded-[5px] border-2 border-[#323232] bg-white px-3 py-1.5 " +
  "text-[15px] font-semibold text-[#323232] shadow-[4px_4px_0_#323232] outline-none " +
  "transition-colors placeholder:text-[#94A3B8] focus:border-accent";

const LABEL = "mb-1.5 block text-[13px] font-extrabold text-[#334155]";

const SECTION_TITLE =
  "mb-4 text-[11px] font-extrabold tracking-[2px] text-accent";

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Countdown cell for the preview (compact variant of the landing cell).
function CdCell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-[5px] border-2 py-2 text-center ${
        accent ? "border-accent bg-accent" : "border-[#323232] bg-white"
      }`}
    >
      <div
        className={`font-mono text-[22px] font-bold leading-none tabular-nums ${
          accent ? "text-white" : "text-[#0F172A]"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-1 text-[9px] font-extrabold tracking-[1.5px] ${
          accent ? "text-[#D1FAE5]" : "text-[#64748B]"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

// The right-hand live preview: the landing card + recap stats.
function Preview({
  name,
  edition,
  priceCents,
  editionSize,
  dropAtMs,
  holdMinutes,
  imagePreview,
  feeBps,
}: {
  name: string;
  edition: string;
  priceCents: number;
  editionSize: number;
  dropAtMs: number | null;
  holdMinutes: number;
  imagePreview: string | null;
  feeBps: number;
}) {
  const cd = useCountdown(dropAtMs ?? Date.now());
  const dateLabel = dropAtMs
    ? new Date(dropAtMs).toLocaleString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "date à définir";

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-extrabold tracking-[2px] text-[#64748B]">
        APERÇU DE LA LANDING
      </div>

      {/* Dark landing card */}
      <div className="overflow-hidden rounded-[5px] border-2 border-[#323232] bg-[#1E293B] shadow-[4px_4px_0_#323232]">
        {/* Visual */}
        <div className="flex h-[190px] items-center justify-center border-b-2 border-[#323232] bg-[#0F172A]">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Aperçu du visuel produit"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-mono text-xs text-[#475569]">visuel produit</span>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="text-[10px] font-extrabold tracking-[1.5px] text-accent">
            PROCHAIN DROP · {dropAtMs && !cd.done ? dateLabel.toUpperCase() : "OUVERT"}
          </div>
          <h2 className="font-heading text-[26px] font-extrabold leading-tight text-white">
            {name || "Nom du modèle"}
          </h2>
          <div className="text-[13px] font-bold text-[#94A3B8]">
            {edition ? `« ${edition} »` : "édition"}
          </div>
          <div className="text-[13px] font-bold text-[#CBD5E1]">
            {editionSize || 0} unités numérotées · {euros(priceCents)} €
          </div>

          {/* Countdown */}
          <div className="mt-1 flex gap-2">
            <CdCell value={cd.hours} label="HEURES" />
            <CdCell value={cd.minutes} label="MINUTES" />
            <CdCell value={cd.seconds} label="SECONDES" accent />
          </div>

          <div className="mt-1 flex h-12 items-center justify-center rounded-[5px] border-2 border-accent bg-accent font-heading text-[15px] font-extrabold text-white">
            Rejoindre le drop
          </div>
        </div>
      </div>

      {/* Recap stats */}
      <div className="flex flex-col gap-2.5 rounded-[5px] border-2 border-border bg-white p-4 text-[13px] font-bold">
        <div className="flex justify-between">
          <span className="text-[#64748B]">Unités générées</span>
          <span className="tabular-nums text-[#0F172A]">
            #001 → #{String(editionSize || 0).padStart(3, "0")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#64748B]">Recette max (brute)</span>
          <span className="tabular-nums text-[#0F172A]">
            {euros(priceCents * (editionSize || 0))} €
          </span>
        </div>
        {/* Net earnings after the platform commission — so the dropper sets the
            price knowing what they actually keep. */}
        <div className="flex justify-between">
          <span className="text-[#64748B]">
            Ton gain net (après {String(feeBps / 100).replace(/\.0$/, "")}%)
          </span>
          <span className="tabular-nums font-extrabold text-accent">
            {euros(Math.round(priceCents * (editionSize || 0) * (1 - feeBps / 10000)))} €
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#64748B]">Hold par unité</span>
          <span className="tabular-nums text-[#0F172A]">{holdMinutes} min</span>
        </div>
      </div>
    </div>
  );
}

export default function CreateDropPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [edition, setEdition] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [editionSizeStr, setEditionSizeStr] = useState("");
  const [maxPerBuyerStr, setMaxPerBuyerStr] = useState("1");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [holdMinutes, setHoldMinutes] = useState(10);
  // Lifetime in days after opening. Empty = lives indefinitely.
  const [durationStr, setDurationStr] = useState("");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Platform commission rate, for the net-earnings line in the preview. Seeded
  // to the default (800 = 8%) so the number is right before the fetch resolves;
  // corrected from the backend in case the operator changed PLATFORM_FEE_BPS.
  const [feeBps, setFeeBps] = useState(800);
  useEffect(() => {
    getPayoutStatus()
      .then((s) => setFeeBps(s.feeBps))
      .catch(() => {}); // keep the default on failure — non-blocking
  }, []);

  // Derived numbers for the preview / payload.
  const priceCents = useMemo(() => {
    const n = Number(priceStr);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [priceStr]);
  const editionSize = Number(editionSizeStr) || 0;
  const maxPerBuyer = Number(maxPerBuyerStr) || 1;

  // Combine date + time into an ISO string (local time → UTC). Null until both set.
  const dropAtIso = useMemo(() => {
    if (!dateStr || !timeStr) return null;
    const d = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [dateStr, timeStr]);
  const dropAtMs = dropAtIso ? new Date(dropAtIso).getTime() : null;

  // Today (local) as YYYY-MM-DD — floor for the date picker so past days can't
  // be picked. Backend still rejects any past dropAt (source of truth).
  const todayStr = useMemo(() => {
    const n = new Date();
    const p = (x: number) => String(x).padStart(2, "0");
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  }, []);

  function messageFor(err: unknown): string {
    return ERROR_MESSAGES[apiErrorCode(err)] ?? "Une erreur est survenue.";
  }

  // Take a picked/dropped file: local preview immediately, upload in background.
  async function acceptFile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError(ERROR_MESSAGES.unsupported_content_type);
      return;
    }
    setError(null);
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { key } = await uploadImage(file);
      setImageKey(key);
    } catch (err) {
      setError(messageFor(err));
      setImageKey(null);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void acceptFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void acceptFile(file);
  }

  function buildPayload(): CreateDropPayload {
    return {
      name: name.trim(),
      description: description.trim() || null,
      edition: edition.trim() || null,
      price: priceCents,
      maxPerBuyer,
      holdMinutes,
      editionSize,
      imageKey,
      dropAt: dropAtIso,
      durationDays: Number(durationStr) >= 1 ? Number(durationStr) : null,
    };
  }

  // Save draft: create only (stays DRAFT). Then go to "Mes drops".
  async function handleSaveDraft() {
    if (uploading) return;
    setError(null);
    setBusy(true);
    try {
      await createDrop(buildPayload());
      navigate("/profile");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  // Schedule: create then publish (DRAFT → SCHEDULED). Then go to the landing.
  async function handleSchedule() {
    if (uploading) return;
    setError(null);
    setBusy(true);
    try {
      const { id } = await createDrop(buildPayload());
      await publishDrop(id);
      navigate("/upcoming");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="create" />

      <div className="flex flex-1 flex-col gap-8 px-5 py-6 md:mx-auto md:w-full md:max-w-[1200px] md:px-12 md:py-10">
        {/* Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="font-heading text-[28px] font-extrabold leading-none text-[#0F172A] md:text-[34px]">
              Créer un drop
            </h1>
            <p className="mt-1 text-[13px] font-bold text-secondary">
              Une fois programmé, le stock numéroté est généré automatiquement.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-3.5 shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_400px] md:items-start md:gap-12">
          {/* Preview — first on mobile (stacks on top), right on desktop */}
          <div className="order-first md:order-last">
            <Preview
              name={name}
              edition={edition}
              priceCents={priceCents}
              editionSize={editionSize}
              dropAtMs={dropAtMs}
              holdMinutes={holdMinutes}
              imagePreview={imagePreview}
              feeBps={feeBps}
            />
          </div>

          {/* Form */}
          <form
            className="flex flex-col gap-8"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSchedule();
            }}
          >
            {/* 01 · PRODUIT */}
            <section className="rounded-[5px] border-2 border-[#323232] bg-white p-5 shadow-[4px_4px_0_#323232]">
              <div className={SECTION_TITLE}>01 · PRODUIT</div>

              {/* Image dropzone */}
              <div className="mb-4">
                <span className={LABEL}>Visuel produit</span>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[5px] border-2 border-dashed border-[#94A3B8] bg-muted text-center transition-colors hover:border-accent"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    onChange={onFileChange}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Aperçu" className="h-full w-full rounded-[3px] object-cover" />
                  ) : (
                    <>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span className="text-[12px] font-bold text-[#64748B]">
                        Glisser une image ou parcourir
                      </span>
                    </>
                  )}
                </div>
                {uploading && (
                  <p className="mt-1.5 text-[12px] font-bold text-accent">Envoi de l'image…</p>
                )}
                {imageKey && !uploading && (
                  <p className="mt-1.5 text-[12px] font-bold text-accent">Image envoyée ✓</p>
                )}
              </div>

              <div className="mb-4">
                <label className={LABEL} htmlFor="name">Nom du modèle</label>
                <input id="name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="VOLT-01" />
              </div>

              <div className="mb-4">
                <label className={LABEL} htmlFor="edition">Édition / coloris</label>
                <input id="edition" className={INPUT} value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="Ardoise Émeraude" />
              </div>

              <div>
                <label className={LABEL} htmlFor="description">
                  Description <span className="font-semibold text-[#94A3B8]">(optionnel)</span>
                </label>
                <textarea
                  id="description"
                  className={`${INPUT} h-[70px] resize-none py-2`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deux lignes max, pour la page du drop."
                />
              </div>
            </section>

            {/* 02 · STOCK & PRIX */}
            <section className="rounded-[5px] border-2 border-[#323232] bg-white p-5 shadow-[4px_4px_0_#323232]">
              <div className={SECTION_TITLE}>02 · STOCK &amp; PRIX</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={LABEL} htmlFor="price">Prix unitaire (€)</label>
                  <input id="price" type="number" min="1" className={INPUT} value={priceStr} onChange={(e) => setPriceStr(e.target.value)} placeholder="179" />
                </div>
                <div>
                  <label className={LABEL} htmlFor="editionSize">Nombre d'unités</label>
                  <input id="editionSize" type="number" min="1" max="100" className={INPUT} value={editionSizeStr} onChange={(e) => setEditionSizeStr(e.target.value)} placeholder="100" />
                </div>
                <div>
                  <label className={LABEL} htmlFor="maxPerBuyer">Limite / acheteur</label>
                  <input id="maxPerBuyer" type="number" min="1" className={INPUT} value={maxPerBuyerStr} onChange={(e) => setMaxPerBuyerStr(e.target.value)} placeholder="1" />
                </div>
              </div>
              <p className="mt-3 text-[12px] font-bold text-[#64748B]">
                Unités générées : #001 → #{String(editionSize || 0).padStart(3, "0")} · chacune individuellement numérotée.
              </p>
            </section>

            {/* 03 · OUVERTURE & RÉSERVATION */}
            <section className="rounded-[5px] border-2 border-[#323232] bg-white p-5 shadow-[4px_4px_0_#323232]">
              <div className={SECTION_TITLE}>03 · OUVERTURE &amp; RÉSERVATION</div>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="date">Date d'ouverture</label>
                  <input id="date" type="date" min={todayStr} className={INPUT} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="time">Heure d'ouverture</label>
                  <input id="time" type="time" className={INPUT} value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
                </div>
              </div>

              <span className={LABEL}>Durée de réservation (hold)</span>
              <p className="mb-3 text-[12px] font-bold text-[#64748B]">
                Temps laissé à l'acheteur pour payer une unité saisie avant qu'elle reparte en vente.
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {HOLD_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHoldMinutes(m)}
                    aria-pressed={holdMinutes === m}
                    className={`h-11 rounded-[5px] border-2 text-[14px] font-extrabold transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      holdMinutes === m
                        ? "border-accent bg-accent text-white shadow-[3px_3px_0_#323232]"
                        : "border-[#323232] bg-white text-[#334155] shadow-[3px_3px_0_#323232]"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>

              <label className={`${LABEL} mt-4 block`} htmlFor="duration">
                Durée de vie (jours) — optionnel
              </label>
              <p className="mb-2 text-[12px] font-bold text-[#64748B]">
                Après ce délai, si le drop n'est pas épuisé il est automatiquement suspendu et libère la place.
                Vide = reste en ligne indéfiniment. Tu pourras le réactiver.
              </p>
              <input
                id="duration"
                type="number"
                min="1"
                className={`${INPUT} max-w-[180px]`}
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="ex : 7"
              />
            </section>

            {/* CTAs */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <button
                type="submit"
                disabled={busy || uploading}
                className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[16px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-55 md:px-7"
              >
                {busy ? "…" : "Programmer le drop"}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={busy || uploading}
                className="h-12 rounded-[5px] border-2 border-[#323232] bg-white font-heading text-[16px] font-extrabold text-[#334155] shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-55 md:px-7"
              >
                Enregistrer le brouillon
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={busy}
                className="h-12 text-[14px] font-extrabold text-secondary hover:text-[#0F172A] md:ml-auto md:px-4"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
