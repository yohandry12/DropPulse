import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { apiErrorCode } from "../../services/httpClient";
import { displayName, initialsFor } from "../../services/userService";
import {
  getDropperRequests,
  approveDropperRequest,
  type AdminDropperRequest,
} from "../../services/adminService";

// A4 — habilitation queue. Card list (per public/Demandes maquette): each request
// shows the requester (name + email), project note and a green "Approuver".
// Approving a PENDING request generates + reveals the single-use validation code
// in a highlighted "CANAL ADMIN" panel (channel B — admin relays it out-of-app;
// the requester also sees it in-app via channel C). Mirrors DESIGN_BRIEF_ADMIN A4.

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

function StatusPill({ status }: { status: "PENDING" | "APPROVED" }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[5px] border-2 border-[#D97706] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-[#B45309]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
        EN ATTENTE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[5px] border-2 border-accent bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-[0.5px] text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      APPROUVÉE
    </span>
  );
}

// The revealed validation code in its highlighted admin channel panel.
function CodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-[5px] border-2 border-accent bg-[#ECFDF5] p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[1px] text-accent">
        Code de validation · Canal admin
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="font-mono text-[26px] font-extrabold tracking-[4px] text-[#0F172A]">
          {code}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="flex h-9 flex-none items-center gap-1.5 rounded-[5px] border-2 border-[#323232] bg-white px-3 text-[12px] font-bold text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          {copied ? (
            "Copié"
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copier
            </>
          )}
        </button>
      </div>
      <p className="mt-1 text-[11px] font-bold text-[#059669]">En attente de saisie par le demandeur.</p>
    </div>
  );
}

function ApproveButton({ onApprove, busy }: { onApprove: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onApprove}
      disabled={busy}
      className="h-10 flex-none rounded-[5px] border-2 border-[#323232] bg-accent px-5 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Approbation…" : "Approuver"}
    </button>
  );
}

// One request card. Header row: avatar + name + status pill, then email · date,
// then the project note. PENDING gets the Approuver button; APPROVED gets the
// code panel.
function RequestCard({
  req,
  busy,
  onApprove,
}: {
  req: AdminDropperRequest;
  busy: boolean;
  onApprove: (id: string) => void;
}) {
  return (
    <div className="rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-extrabold text-white">
          {initialsFor(req.user)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-[16px] font-extrabold text-[#0F172A]">
              {displayName(req.user)}
            </span>
            <StatusPill status={req.status} />
          </div>
          <p className="mt-0.5 truncate text-[12px] font-semibold text-secondary">
            {req.user.email} · demande du {dateLabel(req.createdAt)}
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-[#334155]">
            Projet : <span className="italic">« {req.projectNote} »</span>
          </p>
        </div>
        {req.status === "PENDING" && (
          <div className="hidden sm:block">
            <ApproveButton busy={busy} onApprove={() => onApprove(req.id)} />
          </div>
        )}
      </div>

      {req.status === "APPROVED" && req.code && <CodePanel code={req.code} />}

      {/* Mobile: full-width approve button below the content */}
      {req.status === "PENDING" && (
        <div className="mt-3 sm:hidden">
          <button
            type="button"
            onClick={() => onApprove(req.id)}
            disabled={busy}
            className="h-11 w-full rounded-[5px] border-2 border-[#323232] bg-accent font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {busy ? "Approbation…" : "Approuver"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminDropperRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    getDropperRequests()
      .then(setRequests)
      .catch((e) => setError(apiErrorCode(e)));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    if (busyId) return;
    setActionError(null);
    setBusyId(id);
    try {
      const updated = await approveDropperRequest(id);
      // Merge the revealed code in place — no refetch, no layout jump.
      setRequests((prev) =>
        prev
          ? prev.map((r) =>
              r.id === id
                ? { ...r, status: "APPROVED", code: updated.code, approvedAt: updated.approvedAt }
                : r,
            )
          : prev,
      );
    } catch (e) {
      setActionError(apiErrorCode(e));
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = requests?.filter((r) => r.status === "PENDING").length ?? 0;

  return (
    <AdminLayout active="requests">
      <div className="mb-5">
        <h1 className="font-heading text-[26px] font-extrabold leading-none text-[#0F172A] md:text-[30px]">
          Demandes dropper
        </h1>
        <p className="mt-2 max-w-[560px] text-[13px] font-semibold text-secondary">
          Approuve une demande pour générer son code de validation à usage unique. Le demandeur le
          saisit ensuite dans son espace.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-[5px] border-2 border-destructive bg-white p-3 text-[13px] font-bold text-[#0F172A] shadow-[3px_3px_0_#DC2626]">
          Action impossible — code : {actionError}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
          <p className="text-sm font-bold text-[#0F172A]">Impossible de charger les demandes.</p>
          <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
        </div>
      )}

      {!requests && !error && (
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[5px] border-2 border-border bg-white" />
          ))}
        </div>
      )}

      {requests && requests.length === 0 && (
        <div className="rounded-[5px] border-2 border-dashed border-[#94A3B8] bg-white p-10 text-center">
          <p className="font-heading text-[18px] font-extrabold text-[#0F172A]">
            Aucune demande en attente.
          </p>
          <p className="mt-1 text-[13px] font-bold text-secondary">
            Les nouvelles candidatures apparaîtront ici.
          </p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <>
          {pendingCount > 0 && (
            <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#94A3B8]">
              {pendingCount} en attente
            </p>
          )}
          <div className="flex flex-col gap-3.5">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                busy={busyId === req.id}
                onApprove={handleApprove}
              />
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
