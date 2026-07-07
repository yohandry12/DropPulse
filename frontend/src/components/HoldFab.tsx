import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMyHold, type ActiveHold } from "../services/dropService";

// Floating "voir ma réservation" button. Shown across the authenticated app
// (mounted in AppHeader, which every logged-in drop screen renders) whenever the
// user has a live hold. Tapping it jumps to /hold. It re-probes on every route
// change so it appears right after a reservation and disappears after checkout /
// release / expiry. Hidden on /hold itself (you're already there).
export default function HoldFab() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [hold, setHold] = useState<ActiveHold | null>(null);

  useEffect(() => {
    let alive = true;
    getMyHold()
      .then((h) => alive && setHold(h))
      .catch(() => alive && setHold(null)); // 404 = no active hold
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!hold || pathname === "/hold") return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/hold")}
      aria-label={`Voir ma réservation en cours : ${hold.productName}`}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-[5px] border-2 border-[#323232] bg-accent px-4 py-3 font-heading text-[14px] font-extrabold text-white shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-none md:bottom-7 md:right-7"
    >
      {/* Cart icon */}
      <span className="relative flex-none">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {/* Live dot */}
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-[#0F172A]" />
      </span>
      <span className="hidden sm:inline">Ma réservation</span>
    </button>
  );
}
