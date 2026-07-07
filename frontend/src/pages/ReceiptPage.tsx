import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { getPurchaseReceipt, type Receipt } from "../services/purchasesService";
import { apiErrorCode } from "../services/httpClient";

// Receipt for one purchase (/purchases/:id). Full detail: order number, amount
// paid, dates, drop + numbered unit. Deep-linkable. Falls back gracefully when
// the purchase has no Stripe Order (simulated payment).

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Short, human order code: prefer the Order id (Stripe purchase); else derive
// from the serial for simulated buys, matching the list's "FD-…" convention.
function orderCode(r: Receipt): string {
  if (r.order) return `CMD-${r.order.id.slice(0, 8).toUpperCase()}`;
  const digits = r.serialNumber.replace(/\D/g, "").padStart(4, "0");
  return `FD-${digits}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-[13px] font-semibold text-secondary">{label}</span>
      <span className="text-right font-heading text-[14px] font-bold text-[#0F172A]">{value}</span>
    </div>
  );
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getPurchaseReceipt(id)
      .then((r) => alive && setReceipt(r))
      .catch((e) => alive && setError(apiErrorCode(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="purchases" />

      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-[520px] md:px-0">
        <button
          type="button"
          onClick={() => navigate("/purchases")}
          className="self-start text-[13px] font-extrabold text-[#64748B] transition-colors hover:text-[#0F172A]"
        >
          ← Retour à mes achats
        </button>

        {error && (
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">
              {error === "purchase_not_found"
                ? "Achat introuvable."
                : "Impossible de charger le reçu."}
            </p>
          </div>
        )}

        {!receipt && !error && (
          <div className="h-[420px] animate-pulse rounded-[5px] border-2 border-border bg-white" />
        )}

        {receipt && (
          <div className="overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232]">
            {/* Header band */}
            <div className="flex items-center gap-4 border-b-2 border-dashed border-border bg-muted p-5">
              <div className="relative h-20 w-20 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
                {receipt.imageUrl ? (
                  <img
                    src={receipt.imageUrl}
                    alt={`Visuel du drop ${receipt.productName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]">
                    <span className="font-mono text-sm font-bold text-[#0F172A]">
                      {receipt.serialNumber}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold tracking-[2px] text-accent">REÇU</div>
                <div className="mt-0.5 truncate font-heading text-[18px] font-extrabold text-[#0F172A]">
                  {receipt.productName}
                </div>
                {receipt.edition && (
                  <div className="text-[12px] font-semibold text-secondary">{receipt.edition}</div>
                )}
              </div>
            </div>

            {/* Detail rows */}
            <div className="divide-y divide-border px-5 py-3">
              <Row label="N° de commande" value={<span className="font-mono">{orderCode(receipt)}</span>} />
              <Row
                label="Exemplaire"
                value={<span className="font-mono text-accent">{receipt.serialNumber}</span>}
              />
              <Row label="Date d'achat" value={fmtDateTime(receipt.order?.paidAt ?? receipt.soldAt)} />
              {receipt.order && (
                <Row
                  label="Statut"
                  value={
                    <span
                      className={
                        receipt.order.status === "PAID" ? "text-accent" : "text-[#64748B]"
                      }
                    >
                      {receipt.order.status === "PAID" ? "Payé" : receipt.order.status}
                    </span>
                  }
                />
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t-2 border-[#323232] bg-[#0F172A] px-5 py-4">
              <span className="font-heading text-[15px] font-extrabold text-white">Total payé</span>
              <span className="font-mono text-[20px] font-extrabold tabular-nums text-white">
                {euros(receipt.amountPaid)} €
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
