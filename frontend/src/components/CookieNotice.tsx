import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Transparency notice (not a consent banner). DropPulse uses only strictly-
// necessary storage, so no consent is legally required — this just informs and
// links to the cookie policy. Dismissed state is remembered in localStorage so
// it appears once. Kept out of the auth flow: shown site-wide, low z, bottom.

const DISMISS_KEY = "flashdrop.cookieNoticeSeen";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay a beat so it doesn't fight the first paint / hero animation.
    if (localStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[560px] rounded-[8px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] md:inset-x-auto md:left-4 md:right-auto">
      <p className="text-[13px] font-semibold leading-relaxed text-[#334155]">
        DropPulse utilise uniquement des cookies strictement nécessaires (pour te
        garder connecté). Aucun traceur publicitaire ou de mesure d'audience.{" "}
        <Link to="/cookies" className="font-bold text-accent hover:underline">
          En savoir plus
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="h-9 rounded-[5px] border-2 border-[#323232] bg-accent px-5 text-[13px] font-extrabold text-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
