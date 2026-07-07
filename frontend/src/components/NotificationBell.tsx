import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "../services/notificationService";
import { Rocket, Clock, CheckCircle, AlertTriangle } from "lucide-react";

// Header bell: unread badge + dropdown centre. Fetches on mount and on open,
// and polls every 30s so a notification raised by the worker (drop opened,
// hold expiring) surfaces without a page reload. Closes on outside-click/Escape.

const POLL_MS = 30_000;

// A small emoji glyph per type — matches the app's SVG-free, playful register.

const ICON: Record<NotificationType, React.ReactNode> = {
  DROP_OPEN: <Rocket className="text-blue-500" size={20} />,
  DROP_SOON: <Clock className="text-yellow-500" size={20} />,
  PAYMENT_CONFIRMED: <CheckCircle className="text-green-500" size={20} />,
  HOLD_EXPIRING: <AlertTriangle className="text-orange-500" size={20} />,
};

// Relative "il y a X" label — fr, compact.
function ago(iso: string): string {
  const s = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const feed = await getNotifications();
      setUnread(feed.unread);
      setItems(feed.items);
    } catch {
      // Silent: the bell is ambient, a failed poll just keeps the last state.
    }
  }

  // Poll on mount + interval.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Refresh the moment the panel opens (freshest list on click).
  useEffect(() => {
    if (open) load();
  }, [open]);

  // Outside-click / Escape to close (mirrors ProfileMenu).
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

  async function onItemClick(n: AppNotification) {
    if (!n.read) {
      // Optimistic: flip locally, then persist.
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.productId) navigate(`/upcoming/${n.productId}`);
  }

  async function onReadAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#0F172A] shadow-[2px_2px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#323232] md:h-[34px] md:w-[34px]"
      >
        {/* Bell glyph */}
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-destructive px-1 text-[10px] font-extrabold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232]"
        >
          <div className="flex items-center justify-between border-b-2 border-border px-4 py-2.5">
            <span className="font-heading text-[14px] font-extrabold text-[#0F172A]">
              Notifications
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onReadAll}
                className="text-[12px] font-bold text-accent hover:underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] font-semibold text-secondary">
                Aucune notification pour l'instant.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted ${
                    n.read ? "" : "bg-[#F0FDF9]"
                  }`}
                >
                  <span
                    className="mt-0.5 flex-none text-[16px]"
                    aria-hidden="true"
                  >
                    {ICON[n.type]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-heading text-[13px] font-extrabold text-[#0F172A]">
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 flex-none rounded-full bg-accent" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-secondary">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold text-[#94A3B8]">
                      {ago(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
