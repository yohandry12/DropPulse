import { useLocation, useNavigate } from "react-router-dom";

// "Confirmation d'achat" screen (maquette 1e). Celebration tone: full green
// (#059669) background, hero serial number, receipt card. Reached after paying
// on the hold screen, which passes the paid unit's serialNumber via router
// state. Light neobrutalist card on the green field.

// Serial "VOLT01-0042" → hero "#042" + order "FD-07-0042".
function heroSerial(serial: string): string {
  const digits = serial.replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `#${digits}`;
}
function orderCode(serial: string): string {
  const digits = serial.replace(/\D/g, "").padStart(4, "0");
  return `FD-07-${digits}`;
}

// One row of the receipt (label left, value right).
function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-[13px] font-bold">
      <span className="text-[#64748B]">{label}</span>
      <span className={`text-[#0F172A] ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span>
    </div>
  );
}

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const serialNumber = (location.state as { serialNumber?: string } | null)?.serialNumber ?? "";
  const SERIAL = serialNumber ? heroSerial(serialNumber) : "#—";
  const ORDER = serialNumber ? orderCode(serialNumber) : "FD-07-————";

  return (
    <div className="flex min-h-dvh flex-col bg-accent">
      {/* Bare centered header — no nav on the celebration screen */}
      <header className="flex h-14 flex-none items-center justify-center">
        <span className="font-heading text-lg font-extrabold text-white">DropPulse</span>
      </header>

      <div className="flex flex-1 flex-col gap-[18px] px-5 pb-6 pt-3.5 md:mx-auto md:w-full md:max-w-[440px]">
        {/* Hero: check + headline */}
        <div className="text-center text-white">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-heading text-[34px] font-extrabold leading-[1.05]">Elle est à toi.</h2>
          <p className="mt-2 text-sm font-bold text-[#D1FAE5]">
            Payée, numérotée, réservée à ton nom.
          </p>
        </div>

        {/* Receipt card */}
        <div className="overflow-hidden rounded-[5px] border-2 border-[#323232] bg-background shadow-[4px_4px_0_#022C22]">
          <div className="px-[18px] pb-3.5 pt-[18px] text-center">
            <div className="text-[11px] font-extrabold tracking-[2px] text-[#64748B]">
              TON NUMÉRO DE SÉRIE
            </div>
            <div className="font-mono text-[72px] font-bold leading-none tabular-nums text-[#0F172A]">
              {SERIAL}
              <span className="text-[28px] text-[#94A3B8]">/100</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t-2 border-dashed border-[#CBD5E1] px-[18px] py-3.5">
            <Row label="Modèle" value="VOLT-01 « Ardoise Émeraude »" />
            <Row label="Drop" value="#07 · 3 juillet 2026" />
            <Row label="Payé" value="179,00 €" mono />
            <Row label="Commande" value={ORDER} mono />
          </div>
        </div>

        <p className="text-center text-xs font-bold text-[#D1FAE5]">
          Tu fais partie des 100. Confirmation envoyée par e-mail.
        </p>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/purchases")}
            className="h-14 rounded-[5px] border-2 border-[#323232] bg-background font-sans text-[17px] font-extrabold text-[#0F172A] shadow-[4px_4px_0_#022C22] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Voir mes achats
          </button>
          <button
            type="button"
            onClick={() => navigate("/drop")}
            className="h-11 rounded-[5px] border-2 border-white/50 bg-transparent text-sm font-extrabold text-white transition-colors hover:border-white"
          >
            Retour aux drops
          </button>
        </div>
      </div>
    </div>
  );
}
