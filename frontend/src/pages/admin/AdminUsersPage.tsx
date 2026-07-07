import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useProfile } from "../../hooks/useProfile";
import { apiErrorCode } from "../../services/httpClient";
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  bulkDeleteUsers,
  type AdminUser,
  type UserRole,
  type UserStatus,
} from "../../services/adminUsersService";

// A2 — user management. Every account with role, status, join date, purchase
// count. Search by email; filter by role and by active/disabled. Per-row: toggle
// enable/disable (1-click), edit (pencil → "Mettre à jour" modal for role+status),
// hard-delete (trash → "Supprimer définitivement" modal with an irreversibility
// checkbox). Row actions are hover-revealed on desktop, always visible on mobile.
// An admin cannot act on its own row (backend also refuses). Mirrors
// DESIGN_BRIEF_ADMIN.md A2 + public/Utilisateurs + modal maquettes.

const ROLE_FILTERS: { key: "ALL" | UserRole; label: string }[] = [
  { key: "ALL", label: "Tous" },
  { key: "CHASER", label: "Chaser" },
  { key: "DROPPER", label: "Dropper" },
  { key: "ADMIN", label: "Admin" },
];

const STATUS_FILTERS: { key: "ALL" | "ACTIVE" | "DISABLED"; label: string }[] = [
  { key: "ALL", label: "Tous" },
  { key: "ACTIVE", label: "Actifs" },
  { key: "DISABLED", label: "Désactivés" },
];

const ROLE_LABEL: Record<UserRole, string> = {
  CHASER: "CHASER",
  DROPPER: "DROPPER",
  ADMIN: "ADMIN",
};

const ROLE_OPTIONS: { key: UserRole; label: string }[] = [
  { key: "CHASER", label: "Chaser" },
  { key: "DROPPER", label: "Dropper" },
  { key: "ADMIN", label: "Admin" },
];

const ERROR_MESSAGES: Record<string, string> = {
  cannot_modify_self: "Action interdite sur ton propre compte.",
  invalid_role: "Rôle invalide.",
  invalid_status: "Statut invalide.",
  user_not_found: "Utilisateur introuvable.",
  invalid_ids: "Sélection invalide.",
  no_targets: "Aucun compte à supprimer.",
  network_error: "Réseau indisponible.",
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initialsFor(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[.\-_]/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

// Role badge — dark filled for ADMIN, accent outline for DROPPER, muted for CHASER.
function RoleBadge({ role }: { role: UserRole }) {
  const cls =
    role === "ADMIN"
      ? "border-[#323232] bg-[#0F172A] text-white"
      : role === "DROPPER"
        ? "border-accent bg-white text-accent"
        : "border-[#CBD5E1] bg-muted text-[#475569]";
  return (
    <span className={`inline-flex items-center rounded-[5px] border-2 px-2 py-0.5 text-[11px] font-extrabold tracking-[0.5px] ${cls}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center rounded-[5px] border-2 border-accent bg-white px-2 py-0.5 text-[11px] font-extrabold tracking-[0.5px] text-accent">
        ACTIF
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[5px] border-2 border-[#D97706] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-extrabold tracking-[0.5px] text-[#B45309]">
      DÉSACTIVÉ
    </span>
  );
}

// Shared modal shell: centered card over a dimmed backdrop. Closes on backdrop
// click or Escape (unless busy). Locks nothing else — back-office, single modal.
function Modal({
  onClose,
  busy,
  children,
}: {
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/45 px-4 pb-4 sm:items-center sm:pb-0"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-[5px] border-2 border-[#323232] bg-white p-5 shadow-[6px_6px_0_#323232] sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}

// A segmented single-choice control (Rôle / Statut in the update modal).
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`h-10 flex-1 rounded-[5px] border-2 border-[#323232] text-[13px] font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
            value === o.key
              ? "bg-[#0F172A] text-white shadow-none"
              : "bg-white text-[#334155] shadow-[2px_2px_0_#323232]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// "Mettre à jour le compte" — edit role + status together. Enregistrer diffs
// against the original and fires PATCH /role and/or /status (0, 1 or 2 calls).
function UpdateModal({
  user,
  busy,
  onSave,
  onClose,
}: {
  user: AdminUser;
  busy: boolean;
  onSave: (role: UserRole, status: UserStatus) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const dirty = role !== user.role || status !== user.status;

  return (
    <Modal onClose={onClose} busy={busy}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-[#D97706] bg-[#FEF3C7] text-[18px] font-extrabold text-[#B45309]">
          !
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold text-[#0F172A]">Mettre à jour le compte</h2>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-secondary">{user.email}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#475569]">Rôle</p>
        <Segmented options={ROLE_OPTIONS} value={role} onChange={setRole} />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#475569]">Statut du compte</p>
        <Segmented
          options={[
            { key: "ACTIVE", label: "Actif" },
            { key: "DISABLED", label: "Désactivé" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-white px-4 text-[14px] font-bold text-[#334155] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => onSave(role, status)}
          disabled={busy || !dirty}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-accent px-4 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}

// "Supprimer définitivement" — irreversible. The confirm button stays disabled
// until the "I understand" checkbox is ticked.
function DeleteModal({
  user,
  busy,
  onConfirm,
  onClose,
}: {
  user: AdminUser;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [understood, setUnderstood] = useState(false);

  return (
    <Modal onClose={onClose} busy={busy}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-destructive bg-[#FEE2E2] text-[18px] font-extrabold text-destructive">
          !
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold text-[#0F172A]">Supprimer définitivement</h2>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[#475569]">
            Le compte <span className="font-extrabold text-[#0F172A]">{user.email}</span> et tout son historique
            d'achats seront effacés. Cette action ne peut pas être annulée.
          </p>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[5px] border-2 border-border bg-muted p-3">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none accent-[#DC2626]"
        />
        <span className="text-[13px] font-bold text-[#0F172A]">
          Je comprends que ce compte et son historique seront supprimés définitivement. Cette action est irréversible.
        </span>
      </label>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-white px-4 text-[14px] font-bold text-[#334155] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !understood}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-destructive px-4 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </Modal>
  );
}

// "Supprimer N comptes" — bulk hard-delete. Same irreversibility gate as the
// single delete, but lists how many accounts go and a few of their emails.
function BulkDeleteModal({
  users,
  busy,
  onConfirm,
  onClose,
}: {
  users: AdminUser[];
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const count = users.length;
  const preview = users.slice(0, 4);
  const extra = count - preview.length;

  return (
    <Modal onClose={onClose} busy={busy}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[5px] border-2 border-destructive bg-[#FEE2E2] text-[18px] font-extrabold text-destructive">
          !
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-extrabold text-[#0F172A]">
            Supprimer {count} compte{count > 1 ? "s" : ""}
          </h2>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-[#475569]">
            Ces comptes et tout leur historique d'achats seront effacés. Cette action ne peut pas être annulée.
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[140px] overflow-y-auto rounded-[5px] border-2 border-border bg-muted p-3">
        <ul className="flex flex-col gap-1">
          {preview.map((u) => (
            <li key={u.id} className="truncate text-[13px] font-bold text-[#0F172A]">
              {u.email}
            </li>
          ))}
        </ul>
        {extra > 0 && (
          <p className="mt-1.5 text-[12px] font-bold text-secondary">et {extra} autre{extra > 1 ? "s" : ""}…</p>
        )}
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-[5px] border-2 border-border bg-white p-3">
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none accent-[#DC2626]"
        />
        <span className="text-[13px] font-bold text-[#0F172A]">
          Je comprends que ces {count} compte{count > 1 ? "s" : ""} et leur historique seront supprimés définitivement.
          Cette action est irréversible.
        </span>
      </label>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-white px-4 text-[14px] font-bold text-[#334155] shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !understood}
          className="h-10 rounded-[5px] border-2 border-[#323232] bg-destructive px-4 font-heading text-[14px] font-extrabold text-white shadow-[3px_3px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Suppression…" : `Supprimer ${count} compte${count > 1 ? "s" : ""}`}
        </button>
      </div>
    </Modal>
  );
}

// The per-row action buttons (toggle status, edit, delete). Hidden for self.
function RowActions({
  user,
  self,
  busy,
  onToggleStatus,
  onEdit,
  onDelete,
}: {
  user: AdminUser;
  self: boolean;
  busy: boolean;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (self) {
    return <span className="text-[12px] font-bold text-[#94A3B8]">Toi-même</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggleStatus}
        disabled={busy}
        className={`h-8 rounded-[5px] border-2 border-[#323232] px-2.5 text-[12px] font-bold shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 ${
          user.status === "ACTIVE" ? "bg-white text-destructive" : "bg-accent text-white"
        }`}
      >
        {user.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        aria-label="Mettre à jour le compte"
        title="Mettre à jour"
        className="flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-[#323232] bg-white text-[#334155] shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label="Supprimer le compte"
        title="Supprimer"
        className="flex h-8 w-8 items-center justify-center rounded-[5px] border-2 border-destructive bg-white text-destructive shadow-[2px_2px_0_#DC2626] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

export default function AdminUsersPage() {
  const { profile } = useProfile();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Which modal is open, and for which user.
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Bulk selection: set of selected user ids + whether the bulk-delete modal and
  // its in-flight state are active. The current admin's own row is never
  // selectable, so the set never contains profile.id.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");

  function load() {
    getUsers()
      .then(setUsers)
      .catch((e) => setError(apiErrorCode(e)));
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, query, roleFilter, statusFilter]);

  // Patch a row in place after a mutation — no refetch, no layout jump.
  function patchUser(id: string, next: Partial<AdminUser>) {
    setUsers((prev) => (prev ? prev.map((u) => (u.id === id ? { ...u, ...next } : u)) : prev));
  }

  // The rows that CAN be selected: visible, minus the current admin's own row.
  const selectable = useMemo(
    () => visible.filter((u) => u.id !== profile?.id),
    [visible, profile?.id],
  );
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const selectedUsers = useMemo(
    () => (users ? users.filter((u) => selected.has(u.id)) : []),
    [users, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select-all toggles the currently selectable (filtered, non-self) rows.
  function toggleAll() {
    setSelected((prev) => {
      if (selectable.every((u) => prev.has(u.id))) {
        // All selectable already picked → clear just those.
        const next = new Set(prev);
        for (const u of selectable) next.delete(u.id);
        return next;
      }
      const next = new Set(prev);
      for (const u of selectable) next.add(u.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (bulkBusy || selected.size === 0) return;
    setActionError(null);
    setBulkBusy(true);
    try {
      const ids = [...selected];
      await bulkDeleteUsers(ids);
      const removed = new Set(ids);
      setUsers((prev) => (prev ? prev.filter((u) => !removed.has(u.id)) : prev));
      clearSelection();
      setBulkOpen(false);
    } catch (e) {
      reportError(e);
    } finally {
      setBulkBusy(false);
    }
  }

  function reportError(e: unknown) {
    const code = apiErrorCode(e);
    setActionError(ERROR_MESSAGES[code] ?? `Erreur : ${code}`);
  }

  async function handleToggleStatus(u: AdminUser) {
    if (busyId) return;
    setActionError(null);
    setBusyId(u.id);
    const next: UserStatus = u.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await updateUserStatus(u.id, next);
      patchUser(u.id, { status: next });
    } catch (e) {
      reportError(e);
    } finally {
      setBusyId(null);
    }
  }

  // Save from the update modal: fire only the PATCHes that actually changed.
  async function handleSaveUpdate(u: AdminUser, role: UserRole, status: UserStatus) {
    if (busyId) return;
    setActionError(null);
    setBusyId(u.id);
    try {
      if (role !== u.role) await updateUserRole(u.id, role);
      if (status !== u.status) await updateUserStatus(u.id, status);
      patchUser(u.id, { role, status });
      setEditUser(null);
    } catch (e) {
      reportError(e);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete(u: AdminUser) {
    if (busyId) return;
    setActionError(null);
    setBusyId(u.id);
    try {
      await deleteUser(u.id);
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev));
      setDeleteTarget(null);
    } catch (e) {
      reportError(e);
    } finally {
      setBusyId(null);
    }
  }

  const total = users?.length ?? 0;

  return (
    <AdminLayout active="users">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[26px] font-extrabold leading-none text-[#0F172A] md:text-[30px]">
            Utilisateurs
          </h1>
          <p className="mt-1.5 text-[13px] font-bold text-secondary">
            Tous les comptes de la plateforme
          </p>
        </div>
        <span className="flex-none text-[13px] font-bold tabular-nums text-secondary">
          {visible.length} / {total} comptes
        </span>
      </div>

      {/* Search + filters */}
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un e-mail…"
              className="h-10 w-full rounded-[5px] border-2 border-[#323232] bg-white pl-9 pr-3 text-[14px] font-semibold text-[#0F172A] shadow-[3px_3px_0_#323232] outline-none placeholder:text-[#94A3B8] focus:shadow-[1px_1px_0_#323232]"
            />
          </div>
          <div className="flex gap-2">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setRoleFilter(f.key)}
                className={`h-10 rounded-[5px] border-2 border-[#323232] px-3 text-[13px] font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] ${
                  roleFilter === f.key
                    ? "bg-[#0F172A] text-white shadow-none"
                    : "bg-white text-[#334155] shadow-[2px_2px_0_#323232]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`h-8 rounded-[5px] border-2 border-border px-3 text-[12px] font-bold transition-colors ${
                statusFilter === f.key ? "bg-muted text-[#0F172A]" : "bg-white text-[#64748B] hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-[5px] border-2 border-destructive bg-white p-3 text-[13px] font-bold text-[#0F172A] shadow-[3px_3px_0_#DC2626]">
          {actionError}
        </div>
      )}

      {/* Bulk-selection action bar — appears once at least one row is checked. */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[5px] border-2 border-[#323232] bg-[#0F172A] px-4 py-3 shadow-[4px_4px_0_#323232]">
          <span className="text-[14px] font-extrabold text-white">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[13px] font-bold text-[#94A3B8] hover:text-white"
          >
            Tout désélectionner
          </button>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setBulkOpen(true);
            }}
            className="ml-auto flex items-center gap-2 rounded-[5px] border-2 border-[#323232] bg-destructive px-4 py-2 text-[13px] font-extrabold text-white shadow-[2px_2px_0_#000] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Supprimer la sélection
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-[5px] border-2 border-destructive bg-white p-4 text-center shadow-[4px_4px_0_#DC2626]">
          <p className="text-sm font-bold text-[#0F172A]">Impossible de charger les comptes.</p>
          <p className="mt-1 text-xs font-semibold text-[#64748B]">Code : {error}</p>
        </div>
      )}

      {!users && !error && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[5px] border-2 border-border bg-white" />
          ))}
        </div>
      )}

      {users && visible.length === 0 && !error && (
        <div className="rounded-[5px] border-2 border-dashed border-[#94A3B8] bg-white p-10 text-center">
          <p className="font-heading text-[18px] font-extrabold text-[#0F172A]">Aucun compte.</p>
          <p className="mt-1 text-[13px] font-bold text-secondary">
            {total === 0 ? "La plateforme n'a pas encore d'utilisateurs." : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      )}

      {users && visible.length > 0 && (
        <>
          {/* Desktop table — actions hover-revealed per row */}
          <div className="hidden overflow-hidden rounded-[5px] border-2 border-[#323232] bg-white shadow-[4px_4px_0_#323232] md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-[#323232] bg-muted text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#475569]">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectable.length === 0}
                      className="h-4 w-4 accent-[#DC2626] disabled:opacity-40"
                    />
                  </th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Inscrit le</th>
                  <th className="px-4 py-3 text-right">Achats</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const self = u.id === profile?.id;
                  return (
                    <tr
                      key={u.id}
                      className={`group border-b border-border last:border-0 hover:bg-[#F8FAFC] ${
                        selected.has(u.id) ? "bg-[#FEF2F2]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {!self && (
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${u.email}`}
                            checked={selected.has(u.id)}
                            onChange={() => toggleOne(u.id)}
                            className="h-4 w-4 accent-[#DC2626]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">
                            {initialsFor(u.email)}
                          </span>
                          <span className="text-[14px] font-bold text-[#0F172A]">{u.email}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3 text-[13px] font-bold tabular-nums text-secondary">{dateLabel(u.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-[14px] font-extrabold tabular-nums text-[#0F172A]">{u.purchaseCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end transition-opacity opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <RowActions
                            user={u}
                            self={self}
                            busy={busyId === u.id}
                            onToggleStatus={() => handleToggleStatus(u)}
                            onEdit={() => {
                              setActionError(null);
                              setEditUser(u);
                            }}
                            onDelete={() => {
                              setActionError(null);
                              setDeleteTarget(u);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — actions always visible (no hover) */}
          <div className="flex flex-col gap-3 md:hidden">
            {visible.map((u) => {
              const self = u.id === profile?.id;
              return (
                <div
                  key={u.id}
                  className={`rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] ${
                    selected.has(u.id) ? "bg-[#FEF2F2]" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {!self && (
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${u.email}`}
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        className="mt-1 h-4 w-4 flex-none accent-[#DC2626]"
                      />
                    )}
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-[12px] font-extrabold text-white">
                      {initialsFor(u.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-[#0F172A]">{u.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <RoleBadge role={u.role} />
                        <StatusBadge status={u.status} />
                      </div>
                      <p className="mt-1.5 text-[12px] font-bold tabular-nums text-secondary">
                        {dateLabel(u.createdAt)} · {u.purchaseCount} achat{u.purchaseCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <RowActions
                      user={u}
                      self={self}
                      busy={busyId === u.id}
                      onToggleStatus={() => handleToggleStatus(u)}
                      onEdit={() => {
                        setActionError(null);
                        setEditUser(u);
                      }}
                      onDelete={() => {
                        setActionError(null);
                        setDeleteTarget(u);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editUser && (
        <UpdateModal
          user={editUser}
          busy={busyId === editUser.id}
          onSave={(role, status) => handleSaveUpdate(editUser, role, status)}
          onClose={() => setEditUser(null)}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          busy={busyId === deleteTarget.id}
          onConfirm={() => handleConfirmDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {bulkOpen && selectedUsers.length > 0 && (
        <BulkDeleteModal
          users={selectedUsers}
          busy={bulkBusy}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </AdminLayout>
  );
}
