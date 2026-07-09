import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Plus,
  Radio,
  ShoppingBag,
  CalendarClock,
  User,
  Wallet,
  Shield,
  Menu,
  X,
} from "lucide-react";
import type { UserProfile } from "../services/userService";
import { displayName, initialsFor } from "../services/userService";
import { logout } from "../services/authService";
import { clearProfileCache } from "../hooks/useProfile";
import { getPayoutStatus } from "../services/payoutService";

// Mobile-only nav. The desktop header hides its nav below md, so on a phone the
// burger is the ONLY way to reach the tabs, the profile, payments, and logout.
// Opens a full slide-in panel: role-aware nav (icons), then an account card
// with the logout. Backdrop tap / Escape / route change all close it.

type Tab = "drop" | "upcoming" | "purchases" | "create";

type Item = { key: Tab | "profile" | "payments" | "admin"; label: string; to: string; icon: React.ReactNode };

export default function MobileMenu({
  active,
  profile,
  canCreate,
  isAdmin,
}: {
  active: Tab;
  profile: UserProfile | null;
  canCreate: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Payout setup nudge (droppers/admins only) — mirrors the avatar-menu badge.
  const [payoutNeedsSetup, setPayoutNeedsSetup] = useState(false);
  useEffect(() => {
    if (!canCreate) return;
    let alive = true;
    getPayoutStatus()
      .then((s) => alive && setPayoutNeedsSetup(!s.chargesEnabled))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canCreate]);

  // Lock body scroll + focus the close button + Escape-to-close while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onLogout() {
    setOpen(false);
    try {
      await logout();
    } finally {
      clearProfileCache();
      navigate("/login", { replace: true });
    }
  }

  // Nav items, role-aware. Order: the browsing tabs, then the dropper tools,
  // then account + admin. Mirrors what the desktop header + profile menu expose.
  const nav: Item[] = [
    { key: "drop", label: "Drop en cours", to: "/drop", icon: <Radio size={20} /> },
    { key: "upcoming", label: "À venir", to: "/upcoming", icon: <CalendarClock size={20} /> },
    { key: "purchases", label: "Mes achats", to: "/purchases", icon: <ShoppingBag size={20} /> },
    ...(canCreate
      ? [
          { key: "create" as const, label: "Créer un drop", to: "/create", icon: <Plus size={20} /> },
          { key: "create" as const, label: "Mes drops", to: "/my-drops", icon: <LayoutGrid size={20} /> },
          { key: "payments" as const, label: "Paiements", to: "/settings/payments", icon: <Wallet size={20} /> },
        ]
      : []),
    { key: "profile", label: "Mon profil", to: "/profile", icon: <User size={20} /> },
    ...(isAdmin
      ? [{ key: "admin" as const, label: "Administration", to: "/admin", icon: <Shield size={20} /> }]
      : []),
  ];

  return (
    <>
      {/* Burger — mobile only; desktop keeps the inline nav + avatar menu. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none md:hidden"
      >
        <Menu size={18} strokeWidth={2.5} className="text-[#0F172A]" />
        {payoutNeedsSetup && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-destructive" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="lx-menu-backdrop absolute inset-0 bg-black/50"
          />
          {/* Panel — slides in from the right */}
          <div className="lx-menu-panel absolute inset-y-0 right-0 flex w-[86%] max-w-[340px] flex-col border-l-2 border-[#323232] bg-background">
            {/* Header */}
            <div className="flex flex-none items-center justify-between border-b-2 border-border px-4 py-3.5">
              <span className="font-heading text-lg font-extrabold text-[#0F172A]">
                DropPulse
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-9 w-9 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <X size={18} strokeWidth={2.5} className="text-[#0F172A]" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="flex flex-col gap-2">
                {nav.map((item, i) => {
                  const isActive = item.key === active;
                  const showBadge = item.key === "payments" && payoutNeedsSetup;
                  return (
                    <li key={`${item.key}-${i}`}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-[5px] border-2 border-[#323232] px-3.5 py-3 text-[15px] font-extrabold transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                          isActive
                            ? "bg-accent text-white shadow-[3px_3px_0_#323232]"
                            : "bg-white text-[#0F172A] shadow-[3px_3px_0_#323232]"
                        }`}
                      >
                        <span className="flex-none">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="rounded-[4px] border border-destructive bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                            À configurer
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Account card + logout */}
            <div className="flex-none border-t-2 border-border p-3">
              <div className="flex items-center gap-3 rounded-[5px] border-2 border-[#323232] bg-white p-3 shadow-[2px_2px_0_#323232]">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-extrabold text-white">
                  {profile ? initialsFor(profile) : "··"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-heading text-[14px] font-bold text-[#0F172A]">
                      {profile ? displayName(profile) : "…"}
                    </span>
                    {profile && profile.role !== "CHASER" && (
                      <span className="flex-none rounded-[4px] bg-[#0F172A] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                        {profile.role}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] font-semibold text-secondary">
                    {profile?.email ?? ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-none rounded-[5px] px-2.5 py-1.5 text-[13px] font-extrabold text-destructive hover:bg-destructive hover:text-white"
                >
                  Sortir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
