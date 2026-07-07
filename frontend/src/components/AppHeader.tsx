import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../hooks/useProfile";
import { initialsFromEmail } from "../services/userService";
import HoldFab from "./HoldFab";
import NotificationBell from "./NotificationBell";
import { getPayoutStatus } from "../services/payoutService";

// Shared top nav for the authenticated drop screens. `active` highlights the
// current tab (green underline); the others are muted links.

type Tab = "drop" | "upcoming" | "purchases" | "create";

type NavItem = { key: Tab; label: string; to: string };

const NAV: NavItem[] = [
  { key: "drop", label: "Drop en cours", to: "/drop" },
  { key: "upcoming", label: "À venir", to: "/upcoming" },
  { key: "purchases", label: "Mes achats", to: "/purchases" },
];

// Only DROPPER/ADMIN can create drops — surfaced as an extra tab.
const CREATE_TAB: NavItem = {
  key: "create",
  label: "Créer un drop",
  to: "/create",
};

// LIVE badge is only meaningful on the active-drop screen.
function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 rounded-[5px] border-2 border-[#323232] bg-white px-2 py-0.5 shadow-[2px_2px_0_#323232]">
      <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
      <span className="text-[11px] font-extrabold tracking-[1px] text-[#0F172A]">
        LIVE
      </span>
    </span>
  );
}

// Avatar button that opens a dropdown. Items depend on role: a Chaser is
// offered "Devenir dropper"; a Dropper/Admin gets "Mes drops". "Mon profil" is
// always present. Closes on outside-click or Escape.
function ProfileMenu({
  initials,
  canCreate,
  isAdmin,
}: {
  initials: string;
  canCreate: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Payout onboarding state (droppers/admins only). true = account not yet able
  // to receive money → surfaces an "urgent" badge to nudge setup.
  const [payoutNeedsSetup, setPayoutNeedsSetup] = useState(false);
  useEffect(() => {
    if (!canCreate) return;
    let alive = true;
    getPayoutStatus()
      .then((s) => alive && setPayoutNeedsSetup(!s.chargesEnabled))
      .catch(() => {}); // silent: badge just stays off on failure
    return () => {
      alive = false;
    };
  }, [canCreate]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "block px-4 py-2.5 text-[14px] font-bold text-[#334155] hover:bg-muted hover:text-[#0F172A]";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={payoutNeedsSetup ? "Menu du profil (action requise)" : "Menu du profil"}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white transition-transform hover:scale-105 md:h-[34px] md:w-[34px] md:text-[13px]"
      >
        {initials}
        {payoutNeedsSetup && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-destructive" />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white py-1 shadow-[4px_4px_0_#323232]"
        >
          {canCreate ? (
            <Link
              role="menuitem"
              to="/my-drops"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Mes drops
            </Link>
          ) : (
            <Link
              role="menuitem"
              to="/become-dropper"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Devenir dropper
            </Link>
          )}
          {canCreate && (
            <Link
              role="menuitem"
              to="/settings/payments"
              className={`${itemClass} flex items-center justify-between`}
              onClick={() => setOpen(false)}
            >
              <span>Paiements</span>
              {payoutNeedsSetup && (
                <span className="rounded-[4px] border border-destructive bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  À configurer
                </span>
              )}
            </Link>
          )}
          <Link
            role="menuitem"
            to="/profile"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Mon profil
          </Link>
          {isAdmin && (
            <>
              <div className="my-1 border-t border-border" />
              <Link
                role="menuitem"
                to="/admin"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                Administration
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppHeader({
  active,
  live = false,
}: {
  active: Tab;
  live?: boolean;
}) {
  const { profile } = useProfile();
  const initials = profile ? initialsFromEmail(profile.email) : "··";
  const canCreate = profile?.role === "DROPPER" || profile?.role === "ADMIN";
  const isAdmin = profile?.role === "ADMIN";
  const nav = canCreate ? [...NAV, CREATE_TAB] : NAV;
  return (
    <>
      <HoldFab />
      <header className="flex h-14 flex-none items-center justify-between border-b-2 border-border bg-white px-4 md:h-16 md:px-8">
        <div className="flex items-center gap-2.5 md:gap-7">
          <span className="font-heading text-lg font-extrabold text-[#0F172A] md:text-xl">
            DropPulse
          </span>
          <nav className="hidden gap-[22px] md:flex">
            {nav.map((item) =>
              item.key === active ? (
                <span
                  key={item.key}
                  aria-current="page"
                  className="border-b-[3px] border-accent pb-0.5 text-[15px] font-extrabold text-[#0F172A]"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.key}
                  to={item.to}
                  className="text-[15px] font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          {live && (
            <span className="md:hidden">
              <LiveBadge />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {live && (
            <span className="hidden md:block">
              <LiveBadge />
            </span>
          )}
          <NotificationBell />
          <ProfileMenu
            initials={initials}
            canCreate={canCreate}
            isAdmin={isAdmin}
          />
        </div>
      </header>
    </>
  );
}
