import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Users,
  RefreshCcw,
  CheckCircle2,
  Ban,
  Crown,
  KeyRound,
  Search,
} from "lucide-react";
import {
  adminListUsers,
  adminSetStatus,
  adminSetRole,
  type AdminUser,
  type AdminUsersResponse,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

type Filter = "all" | "pending" | "active" | "disabled";

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: number;
  label: string;
  tint: string;
}> = ({ icon, value, label, tint }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tint}`}>
      {icon}
    </div>
    <div>
      <div className="text-3xl font-black leading-none">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    disabled: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-bold border capitalize ${
        map[status] || "bg-gray-50 text-gray-600 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
};

export const AdminPage: React.FC = () => {
  const { profile } = useAuth();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    adminListUsers()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      );
    });
  }, [data, filter, search]);

  const runAction = async (fn: () => Promise<void>, uid: string) => {
    setBusyUid(uid);
    setError("");
    try {
      await fn();
      await adminListUsers().then(setData);
    } catch (e: any) {
      setError(e?.message || "Action failed.");
    } finally {
      setBusyUid(null);
    }
  };

  const stats = data?.stats || { total: 0, pending: 0, active: 0, disabled: 0 };

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
          <Crown size={22} />
        </div>
        <h1 className="font-serif text-4xl text-charcoal">Admin</h1>
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-charcoal"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users size={20} className="text-gray-500" />}
          value={stats.total}
          label="Total users"
          tint="bg-gray-100"
        />
        <StatCard
          icon={<Loader2 size={20} className="text-amber-500" />}
          value={stats.pending}
          label="Pending"
          tint="bg-amber-100"
        />
        <StatCard
          icon={<CheckCircle2 size={20} className="text-green-500" />}
          value={stats.active}
          label="Active"
          tint="bg-green-100"
        />
        <StatCard
          icon={<Ban size={20} className="text-red-500" />}
          value={stats.disabled}
          label="Disabled"
          tint="bg-red-100"
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200">
          {(["all", "pending", "active", "disabled"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-white shadow text-charcoal"
                  : "text-gray-500 hover:text-charcoal"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gold-500" size={28} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 uppercase text-xs tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Key</th>
                  <th className="px-6 py-4 font-semibold">Usage</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.uid === profile?.uid;
                  const isBusy = busyUid === u.uid;
                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-bold text-charcoal">
                          {u.displayName || "—"}
                          {u.role === "admin" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-bold uppercase">
                              <Crown size={12} /> Admin
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-6 py-4">
                        {u.hasApiKey ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                            <KeyRound size={14} /> Set
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {u.generationCount || 0}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {isSelf ? (
                          <div className="text-right text-gray-400 italic">You</div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {isBusy && (
                              <Loader2
                                className="animate-spin text-gray-400"
                                size={16}
                              />
                            )}
                            {u.status === "active" ? (
                              <button
                                disabled={isBusy}
                                onClick={() =>
                                  runAction(
                                    () => adminSetStatus(u.uid, "disabled"),
                                    u.uid
                                  )
                                }
                                className="inline-flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
                              >
                                <Ban size={14} /> Disable
                              </button>
                            ) : (
                              <button
                                disabled={isBusy}
                                onClick={() =>
                                  runAction(
                                    () => adminSetStatus(u.uid, "active"),
                                    u.uid
                                  )
                                }
                                className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                              >
                                <CheckCircle2 size={14} /> Approve
                              </button>
                            )}
                            {u.role !== "admin" && (
                              <button
                                disabled={isBusy}
                                onClick={() =>
                                  runAction(
                                    () => adminSetRole(u.uid, "admin"),
                                    u.uid
                                  )
                                }
                                className="inline-flex items-center gap-1.5 border border-gray-200 text-xs font-bold px-3 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Crown size={14} /> Make admin
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No users match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage summary */}
      <div className="mt-10">
        <h2 className="font-serif text-2xl text-charcoal mb-4">
          Usage across all accounts
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="text-4xl font-black">
            {data?.totalGenerations ?? 0}
          </div>
          <div className="text-gray-500 mt-1">Total designs generated</div>
        </div>
      </div>
    </main>
  );
};
