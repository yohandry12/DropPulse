import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { apiErrorCode } from "../services/httpClient";
import { clearProfileCache } from "../hooks/useProfile";
import {
  getMyRequest,
  submitRequest,
  consumeCode,
  type DropperRequest,
} from "../services/becomeDropperService";

// C1 — "Devenir dropper" (requester side). Four states driven by the request
// status (GET /dropper-requests/me): none → candidature form, PENDING → waiting,
// APPROVED → enter code, CONSUMED → space open. Mirrors public/candidature.jpg,
// pending.jpg, approuvé.jpg, valider.jpg.

type Step = 1 | 2 | 3 | 4;

// Which stepper step the current request status maps to.
function stepFor(req: DropperRequest | null): Step {
  if (!req) return 1;
  if (req.status === "PENDING") return 2;
  if (req.status === "APPROVED") return 3;
  return 4; // CONSUMED
}

const STEP_LABELS: Record<Step, string> = {
  1: "Candidature",
  2: "En attente",
  3: "Code",
  4: "Dropper",
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_project_note: "Décris ton projet en un mot.",
  already_dropper: "Tu es déjà dropper.",
  request_exists: "Tu as déjà une demande en cours.",
  missing_code: "Saisis ton code de validation.",
  no_pending_code: "Aucun code en attente pour ta demande.",
  invalid_code: "Code invalide — vérifie et réessaie.",
};

function msg(code: string): string {
  return ERROR_MESSAGES[code] ?? `Une erreur est survenue (${code}).`;
}

// Progress stepper across the 4 states. Done steps are accent-filled, current is
// dark, upcoming is muted.
function Stepper({ current }: { current: Step }) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <div className="mx-auto flex w-full max-w-[460px] items-center">
      {steps.map((s, i) => {
        const done = s < current;
        const active = s === current;
        const circle = done
          ? "border-accent bg-accent text-white"
          : active
            ? "border-[#323232] bg-[#323232] text-white"
            : "border-[#94A3B8] bg-white text-[#94A3B8]";
        const line = s < current ? "bg-accent" : "bg-[#CBD5E1]";
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-extrabold tabular-nums ${circle}`}
              >
                {s}
              </span>
              <span
                className={`text-[11px] font-bold ${active ? "text-[#0F172A]" : "text-[#94A3B8]"}`}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 mb-5 h-0.5 flex-1 ${line}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Neobrutalist card wrapper. accent=true draws the approved/success green frame.
function Card({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "filled";
}) {
  const border =
    tone === "accent"
      ? "border-accent shadow-[4px_4px_0_#059669]"
      : "border-[#323232] shadow-[4px_4px_0_#323232]";
  const bg = tone === "filled" ? "bg-accent text-white" : "bg-white";
  return (
    <div className={`rounded-[5px] border-2 p-6 md:p-8 ${border} ${bg}`}>{children}</div>
  );
}

// --- State 1: candidature form ---
function Candidature({ onDone }: { onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await submitRequest(note.trim());
      onDone();
    } catch (err) {
      setError(msg(apiErrorCode(err)));
      setBusy(false);
    }
  }

  return (
    <Card>
      <span className="text-[12px] font-extrabold tracking-[1px] text-accent">
        CANDIDATURE
      </span>
      <h1 className="mt-2 font-heading text-[26px] font-extrabold leading-tight text-[#0F172A] md:text-[30px]">
        Tu veux lancer tes propres drops ?
      </h1>
      <p className="mt-3 text-[14px] font-semibold leading-relaxed text-secondary">
        Deviens Dropper et programme tes éditions numérotées. Dis-nous en un mot
        ce que tu prépares — un admin regarde ta demande et te renvoie un code
        d'accès.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#0F172A]">
            Ton projet en un mot
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="sneakers en série limitée"
            maxLength={120}
            className="h-12 rounded-[5px] border-2 border-[#323232] bg-white px-3 text-[15px] font-bold text-[#0F172A] shadow-[2px_2px_0_#323232] outline-none placeholder:font-semibold placeholder:text-[#94A3B8] focus:shadow-[3px_3px_0_#323232]"
          />
        </label>

        {error && (
          <p role="alert" className="text-[13px] font-bold text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || note.trim().length === 0}
          className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </form>
    </Card>
  );
}

// --- State 2: pending ---
function Pending({ req, onRefresh }: { req: DropperRequest; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <span className="inline-flex items-center gap-1.5 rounded-[5px] border-2 border-[#D97706] bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-extrabold tracking-[0.5px] text-[#B45309]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
        EN ATTENTE
      </span>
      <h1 className="mt-3 font-heading text-[24px] font-extrabold leading-tight text-[#0F172A] md:text-[28px]">
        Demande reçue — un admin va la regarder.
      </h1>
      <p className="mt-3 text-[14px] font-semibold leading-relaxed text-secondary">
        Rien à faire de ton côté pour l'instant. À ta prochaine visite, tu
        trouveras ton code de validation ici même.
      </p>

      <div className="mt-5 border-t-2 border-dashed border-[#CBD5E1] pt-4">
        <span className="text-[11px] font-extrabold tracking-[1px] text-[#94A3B8]">
          TON PROJET
        </span>
        <p className="mt-1 text-[15px] font-bold italic text-[#0F172A]">
          « {req.projectNote} »
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onRefresh();
        }}
        className="mt-6 h-11 w-full rounded-[5px] border-2 border-[#323232] bg-white font-heading text-[14px] font-extrabold text-[#0F172A] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {busy ? "Actualisation…" : "Actualiser le statut"}
      </button>
    </Card>
  );
}

// --- State 3: approved, enter code ---
function Approved({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await consumeCode(code.trim());
      clearProfileCache(); // role flipped to DROPPER — force header/gates to refetch
      onDone();
    } catch (err) {
      setError(msg(apiErrorCode(err)));
      setBusy(false);
    }
  }

  return (
    <Card tone="accent">
      <span className="inline-flex rounded-[5px] border-2 border-accent bg-white px-2.5 py-1 text-[11px] font-extrabold tracking-[0.5px] text-accent">
        APPROUVÉE
      </span>
      <h1 className="mt-3 font-heading text-[24px] font-extrabold leading-tight text-[#0F172A] md:text-[28px]">
        Bonne nouvelle — ta demande est approuvée.
      </h1>
      <p className="mt-3 text-[14px] font-semibold leading-relaxed text-secondary">
        Saisis le code de validation reçu de l'admin pour débloquer ton espace de
        création.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#0F172A]">
            Code de validation
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={12}
            autoCapitalize="characters"
            spellCheck={false}
            className="h-12 rounded-[5px] border-2 border-[#323232] bg-white px-3 text-[16px] font-extrabold tracking-[3px] text-[#0F172A] shadow-[2px_2px_0_#323232] outline-none placeholder:font-bold placeholder:tracking-[3px] placeholder:text-[#CBD5E1] focus:shadow-[3px_3px_0_#323232]"
          />
        </label>

        {error && (
          <p role="alert" className="text-[13px] font-bold text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Validation…" : "Valider"}
        </button>
      </form>
    </Card>
  );
}

// --- State 4: consumed, space open ---
function Done() {
  const navigate = useNavigate();
  return (
    <Card tone="filled">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="rounded-[5px] border-2 border-white px-2 py-0.5 text-[11px] font-extrabold tracking-[1px]">
            TU ES DROPPER
          </span>
        </div>
        <h1 className="font-heading text-[26px] font-extrabold leading-tight md:text-[30px]">
          Ton espace création est ouvert.
        </h1>
        <p className="max-w-[420px] text-[14px] font-semibold leading-relaxed text-white/90">
          Tu gardes tous tes avantages d'acheteur — et tu peux maintenant
          programmer tes propres drops numérotés.
        </p>
        <button
          type="button"
          onClick={() => navigate("/create")}
          className="mt-2 flex h-12 items-center gap-2 rounded-[5px] border-2 border-[#323232] bg-white px-6 font-heading text-[15px] font-extrabold text-[#0F172A] shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          Créer mon premier drop
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

export default function BecomeDropperPage() {
  const [req, setReq] = useState<DropperRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    getMyRequest()
      .then((r) => {
        setReq(r);
        setLoaded(true);
      })
      .catch((e) => {
        setError(apiErrorCode(e));
        setLoaded(true);
      });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = stepFor(req);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="drop" />

      <div className="flex flex-1 flex-col gap-8 px-5 py-8 md:mx-auto md:w-full md:max-w-[620px] md:py-12">
        <Stepper current={step} />

        {!loaded && (
          <div className="h-72 animate-pulse rounded-[5px] border-2 border-border bg-white" />
        )}

        {loaded && error && (
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">Impossible de charger ta demande.</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
          </div>
        )}

        {loaded && !error && step === 1 && <Candidature onDone={refresh} />}
        {loaded && !error && step === 2 && req && <Pending req={req} onRefresh={refresh} />}
        {loaded && !error && step === 3 && <Approved onDone={refresh} />}
        {loaded && !error && step === 4 && <Done />}
      </div>
    </div>
  );
}
