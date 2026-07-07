import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useProfile, clearProfileCache } from "../hooks/useProfile";
import { initialsFromEmail } from "../services/userService";
import { logout } from "../services/authService";
import { getDropperRequests } from "../services/adminService";

// Standalone chrome for the admin back-office (A1–A4). Own sidebar (logo + ADMIN
// badge, nav, footer with logout) — the public AppHeader is not reused here; the
// admin registre is "outil" : calme, dense, autonome. Desktop sidebar can
// collapse to icons-only (persisted). Mobile drops to a fixed bottom nav.
// Mirrors public/Espace Admin.pdf (A1).

type AdminTab = "dashboard" | "users" | "drops" | "requests";

type NavItem = { key: AdminTab; label: string; to: string; icon: React.ReactNode };

const NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: "/admin",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    key: "users",
    label: "Utilisateurs",
    to: "/admin/users",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "drops",
    label: "Drops",
    to: "/admin/drops",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    key: "requests",
    label: "Demandes",
    to: "/admin/requests",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <polyline points="9 15 11 17 15 13" />
      </svg>
    ),
  },
];

const COLLAPSE_KEY = "dp.admin.sidebar.collapsed";

// Small red count pill on the "Demandes" nav item (pending habilitations).
function CountBadge({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#323232] bg-destructive px-1 text-[11px] font-extrabold tabular-nums text-white ${className}`}
    >
      {n}
    </span>
  );
}

export default function AdminLayout({
  active,
  children,
}: {
  active: AdminTab;
  children: React.ReactNode;
}) {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Pending habilitations drive the "Demandes" badge. Fetched once per admin
  // mount — cheap enough for a back-office; failures just hide the badge.
  useEffect(() => {
    let alive = true;
    getDropperRequests()
      .then((rs) => {
        if (alive) setPendingCount(rs.filter((r) => r.status === "PENDING").length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      clearProfileCache();
      navigate("/login", { replace: true });
    }
  }

  const email = profile?.email ?? "";
  const initials = profile ? initialsFromEmail(email) : "··";

  function itemClasses(isActive: boolean): string {
    return `flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[14px] font-bold transition-colors ${
      isActive
        ? "border-2 border-[#323232] bg-white text-[#0F172A] shadow-[3px_3px_0_#323232]"
        : "border-2 border-transparent text-[#475569] hover:bg-muted hover:text-[#0F172A]"
    }`;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-none flex-col border-r-2 border-[#323232] bg-white transition-[width] duration-200 md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between gap-2 border-b-2 border-border px-4 py-4">
          {!collapsed && (
            <span className="flex items-center gap-2">
              <span className="font-heading text-lg font-extrabold text-[#0F172A]">DropPulse</span>
              <span className="rounded-[5px] border-2 border-[#323232] bg-[#0F172A] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[1px] text-white">
                ADMIN
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
            aria-pressed={collapsed}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={collapsed ? "" : "rotate-180"}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {/* Back to the user-facing site — the admin area is a separate world,
              this is the way out. */}
          <Link
            to="/drop"
            title={collapsed ? "Retour au site" : undefined}
            className={`mb-2 flex items-center gap-3 rounded-[5px] border-2 border-dashed border-[#94A3B8] px-3 py-2.5 text-[13px] font-bold text-[#475569] transition-colors hover:border-[#323232] hover:bg-muted hover:text-[#0F172A] ${collapsed ? "justify-center" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!collapsed && <span className="whitespace-nowrap">Retour au site</span>}
          </Link>
          {NAV.map((item) => {
            const isActive = item.key === active || pathname === item.to;
            const showBadge = item.key === "requests";
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`${itemClasses(isActive)} ${collapsed ? "justify-center" : ""}`}
              >
                <span className="relative flex-none">
                  {item.icon}
                  {collapsed && showBadge && (
                    <CountBadge n={pendingCount} className="absolute -right-2 -top-2 h-4 min-w-4 text-[10px]" />
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 whitespace-nowrap">{item.label}</span>
                    {showBadge && <CountBadge n={pendingCount} />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: identity + logout */}
        <div className="border-t-2 border-border p-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-[12px] font-extrabold text-white">
              {initials}
            </span>
            {!collapsed && (
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-extrabold text-[#0F172A]">Admin</span>
                <span className="truncate text-[11px] font-semibold text-secondary">{email}</span>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-none text-[13px] font-extrabold text-destructive hover:underline disabled:opacity-50"
              >
                Sortir
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sortir"
              title="Sortir"
              className="mt-2 flex w-full items-center justify-center rounded-[5px] border-2 border-transparent py-1.5 text-destructive hover:bg-muted disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (logo + ADMIN) */}
        <header className="flex h-14 flex-none items-center justify-between border-b-2 border-border bg-white px-4 md:hidden">
          <span className="flex items-center gap-2">
            <span className="font-heading text-lg font-extrabold text-[#0F172A]">DropPulse</span>
            <span className="rounded-[5px] border-2 border-[#323232] bg-[#0F172A] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[1px] text-white">
              ADMIN
            </span>
          </span>
          <span className="flex items-center gap-3">
            <Link
              to="/drop"
              aria-label="Retour au site"
              className="flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-white">
              {initials}
            </span>
          </span>
        </header>

        <main className="flex-1 px-5 py-6 pb-24 md:mx-auto md:w-full md:max-w-[1100px] md:px-10 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t-2 border-[#323232] bg-white md:hidden">
        {NAV.map((item) => {
          const isActive = item.key === active || pathname === item.to;
          const showBadge = item.key === "requests";
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                isActive ? "text-[#0F172A]" : "text-[#94A3B8]"
              }`}
            >
              <span className="relative">
                {item.icon}
                {showBadge && (
                  <CountBadge n={pendingCount} className="absolute -right-2.5 -top-2 h-4 min-w-4 text-[10px]" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
