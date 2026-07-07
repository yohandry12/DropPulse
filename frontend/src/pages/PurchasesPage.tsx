import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { getMyPurchases, type Purchase } from "../services/purchasesService";
import { apiErrorCode } from "../services/httpClient";

// "Mes achats" screen: lists every unit the authed user has paid for
// (GET /units/mine). Light neobrutalist palette, matching the drop pages.

// Serial "#042" (or raw) → order code "FD-07-0042". Drop #07 is the only drop.
function orderCode(serial: string): string {
  const digits = serial.replace(/\D/g, "").padStart(4, "0");
  return `FD-07-${digits}`;
}

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PurchaseCard({ p }: { p: Purchase }) {
  return (
    <Link
      to={`/purchases/${p.id}`}
      className="block overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#323232] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#323232]">
      <div className="flex items-center gap-3.5 border-b-2 border-dashed border-border p-4">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-[5px] border-2 border-[#323232]">
          {p.imageUrl ? (
            <>
              <img src={p.imageUrl} alt={`Visuel du drop ${p.productName}`} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-[#0F172A]/75 py-0.5 text-center font-mono text-[10px] font-bold tabular-nums text-white">
                {p.serialNumber}
              </span>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,#E6E8EA_0_8px,#F2F3F4_8px_16px)]">
              <span className="font-mono text-lg font-bold tabular-nums text-[#0F172A]">{p.serialNumber}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-heading text-base font-bold text-[#0F172A]">{p.productName}</div>
          <div className="text-[13px] font-bold text-secondary">
            Unité <span className="font-mono text-accent">{p.serialNumber}</span>
            <span className="text-[#94A3B8]">/100</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-[#64748B]">
            Payée le {fmtDate(p.soldAt)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-xs text-[#64748B]">{orderCode(p.serialNumber)}</span>
        <span className="font-mono text-[15px] font-extrabold tabular-nums text-[#0F172A]">
          {euros(p.price)} €
        </span>
      </div>
    </Link>
  );
}

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyPurchases()
      .then((data) => {
        if (alive) setPurchases(data);
      })
      .catch((e) => {
        if (alive) setError(apiErrorCode(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader active="purchases" />

      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:mx-auto md:w-full md:max-w-[560px] md:px-0">
        <div>
          <div className="text-[11px] font-extrabold tracking-[2px] text-accent md:text-xs">
            MES ACHATS
          </div>
          <h1 className="mt-1 font-heading text-[28px] font-extrabold text-[#0F172A] md:text-[34px]">
            Ta collection DropPulse
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
            <p className="text-sm font-bold text-[#0F172A]">Impossible de charger tes achats.</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {!purchases && !error && (
          <div className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[132px] animate-pulse rounded-[5px] border-2 border-border bg-white"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {purchases && purchases.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-[5px] border-2 border-[#323232] bg-white px-5 py-10 text-center shadow-[4px_4px_0_#323232]">
            <div className="font-heading text-xl font-extrabold text-[#0F172A]">
              Rien ici… pour l'instant.
            </div>
            <p className="max-w-[320px] text-sm font-semibold text-[#64748B]">
              Tu n'as pas encore saisi d'unité. Le prochain drop t'attend.
            </p>
            <button
              type="button"
              onClick={() => navigate("/drop")}
              className="h-12 rounded-[5px] border-2 border-[#323232] bg-accent px-6 font-sans text-[15px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              Voir le drop en cours
            </button>
          </div>
        )}

        {/* List */}
        {purchases && purchases.length > 0 && (
          <div className="flex flex-col gap-4">
            {purchases.map((p) => (
              <PurchaseCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
