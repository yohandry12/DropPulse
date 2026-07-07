import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Zero-dependency toast system. A provider holds a queue of transient messages;
// useToast() pushes onto it from anywhere. Toasts auto-dismiss and stack
// bottom-right (desktop) / bottom (mobile), in the neobrutalist style.
//
// Scope: toasts are for TRANSIENT action feedback (subscribed, saved, copied,
// an action that failed) — NOT for page-load errors, which stay inline/blocking.

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic id counter — avoids Date.now()/Math.random() and dedup issues.
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => remove(id), AUTO_DISMISS_MS);
  }, [remove]);

  const api = useRef<ToastApi>({
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
  });
  // Keep the closure fresh if push changes (it won't, but stay correct).
  api.current = {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
  };

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      {/* Viewport: fixed, above everything. Non-interactive except the toasts. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-0 sm:max-w-[360px]">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Slide/fade in on mount.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const isSuccess = toast.kind === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className={`pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-[5px] border-2 border-[#323232] bg-white p-3.5 shadow-[4px_4px_0_#323232] transition-all duration-200 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white ${
          isSuccess ? "bg-accent" : "bg-destructive"
        }`}
        aria-hidden="true"
      >
        {isSuccess ? "✓" : "!"}
      </span>
      <span className="flex-1 text-[13px] font-bold leading-snug text-[#0F172A]">
        {toast.message}
      </span>
    </div>
  );
}

// Access the toast API. Throws if used outside the provider (a wiring bug).
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
