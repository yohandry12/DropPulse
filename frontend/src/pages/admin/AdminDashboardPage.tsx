import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { apiErrorCode } from "../../services/httpClient";
import { displayName, initialsFor } from "../../services/userService";
import { getStats, type AdminStats } from "../../services/adminStatsService";
import {
  getDropperRequests,
  approveDropperRequest,
  type AdminDropperRequest,
} from "../../services/adminService";

// A1 — admin dashboard. Greeting + three live counters (users / active drops /
// pending requests), an "attention" panel listing the pending dropper requests
// with inline approve, and three shortcut cards. Counters come from GET
// /admin/stats; the attention list reuses the habilitation queue. Refetches on
// every visit so the numbers reflect actions taken elsewhere in the back-office.
// Mirrors public/Espace Admin.pdf.

function requestDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

// One headline counter card. `accent` renders the amber "attention" treatment.
function Counter({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
  loading: boolean;
}) {
  return (
    <div
      className={`rounded-[5px] border-2 p-4 shadow-[4px_4px_0_#323232] ${
        accent ? "border-[#D97706] bg-[#FEF3C7]" : "border-[#323232] bg-white"
      }`}
    >
      <p className={`text-[11px] font-extrabold uppercase tracking-[1px] ${accent ? "text-[#B45309]" : "text-[#475569]"}`}>
        {label}
      </p>
      {loading ? (
        <div className="mt-1 h-9 w-12 animate-pulse rounded bg-black/10" />
      ) : (
        <p className={`mt-0.5 font-heading text-[34px] font-extrabold leading-none tabular-nums ${accent ? "text-[#B45309]" : "text-[#0F172A]"}`}>
          {value}
        </p>
      )}
      <p className={`mt-1.5 text-[12px] font-bold ${accent ? "text-[#B45309]" : "text-secondary"}`}>{sub}</p>
    </div>
  );
}

// A shortcut card. `dark` is the "Créer un drop" emphasis variant.
function Shortcut({ to, title, hint, dark }: { to: string; title: string; hint: string; dark?: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-[5px] border-2 border-[#323232] p-4 shadow-[4px_4px_0_#323232] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#323232] ${
        dark ? "bg-[#0F172A]" : "bg-white"
      }`}
    >
      <p className={`font-heading text-[15px] font-extrabold ${dark ? "text-white" : "text-[#0F172A]"}`}>
        {title} →
      </p>
      <p className={`mt-1 text-[12px] font-semibold ${dark ? "text-[#94A3B8]" : "text-secondary"}`}>{hint}</p>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [requests, setRequests] = useState<AdminDropperRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  function load() {
    getStats()
      .then(setStats)
      .catch((e) => setError(apiErrorCode(e)));
    getDropperRequests()
      .then(setRequests)
      .catch(() => {}); // the attention panel just hides on failure
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    if (approvingId) return;
    setApprovingId(id);
    try {
      await approveDropperRequest(id);
      // Drop it from the attention list + decrement the pending counter in place.
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      setStats((prev) =>
        prev ? { ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) } : prev,
      );
    } catch (e) {
      setError(apiErrorCode(e));
    } finally {
      setApprovingId(null);
    }
  }

  const pending = requests?.filter((r) => r.status === "PENDING") ?? [];
  const loading = stats === null;

  return (
    <AdminLayout active="dashboard">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="font-heading text-[28px] font-extrabold leading-none text-[#0F172A] md:text-[32px]">
          Bonjour, Admin.
        </h1>
        <p className="mt-2 text-[13px] font-bold text-secondary">
          Voici ce qui se passe sur la plateforme aujourd'hui.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-[5px] border-2 border-destructive bg-white p-3 text-[13px] font-bold text-[#0F172A] shadow-[3px_3px_0_#DC2626]">
          Erreur : {error}
        </div>
      )}

      {/* Counters */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Counter
          label="Utilisateurs"
          value={stats?.users.total ?? 0}
          sub={stats ? `${stats.users.droppers} droppers · ${stats.users.chasers} chasers` : "…"}
          loading={loading}
        />
        <Counter
          label="Drops actifs"
          value={stats?.drops.active ?? 0}
          sub={stats ? `${stats.drops.live} live · ${stats.drops.scheduled} programmés` : "…"}
          loading={loading}
        />
        <Counter
          label="Demandes en attente"
          value={stats?.pendingRequests ?? 0}
          sub="à traiter maintenant"
          accent
          loading={loading}
        />
      </div>

      {/* Attention panel */}
      <div className="mt-5 rounded-[5px] border-2 border-[#323232] bg-white p-4 shadow-[4px_4px_0_#323232] md:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-heading text-[15px] font-extrabold text-[#0F172A]">
            <span className="h-2 w-2 rounded-full bg-[#D97706]" />
            Demande ton attention
          </p>
          <Link to="/admin/requests" className="flex-none text-[13px] font-extrabold text-accent hover:underline">
            Voir la file →
          </Link>
        </div>

        <div className="mt-4 flex flex-col divide-y divide-border">
          {requests === null ? (
            [0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse" />)
          ) : pending.length === 0 ? (
            <p className="py-6 text-center text-[13px] font-bold text-secondary">
              Aucune demande en attente. Tout est à jour.
            </p>
          ) : (
            pending.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">
                  {initialsFor(r.user)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[#0F172A]">{displayName(r.user)}</p>
                  <p className="truncate text-[12px] font-semibold text-secondary">
                    « {r.projectNote} » · {requestDate(r.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApprove(r.id)}
                  disabled={approvingId === r.id}
                  className="h-9 flex-none rounded-[5px] border-2 border-[#323232] bg-accent px-4 text-[13px] font-extrabold text-white shadow-[2px_2px_0_#323232] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
                >
                  {approvingId === r.id ? "…" : "Approuver"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Shortcuts */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Shortcut to="/admin/users" title="Gérer les utilisateurs" hint="Rôles, statuts, comptes" />
        <Shortcut to="/admin/drops" title="Gérer les drops" hint="Tous droppers confondus" />
        <Shortcut to="/create" title="Créer un drop" hint="Même outil que les droppers" dark />
      </div>
    </AdminLayout>
  );
}
