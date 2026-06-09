"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";

interface EventStat {
  id: string;
  name: string;
  revenue: number;
  collected: number;
  outstanding: number;
  sold: number;
  available: number;
}

interface CategoryStat {
  categoryId: string;
  name: string;
  eventName: string;
  sold: number;
  available: number;
  defaulted: number;
  revoked: number;
  totalOrders: number;
}

interface Props {
  eventStats: EventStat[];
  grandRevenue: number;
  grandCollected: number;
  grandOutstanding: number;
  grandSold: number;
  grandAvailable: number;
  grandComplimentaryIssued: number;
  categoryStats: CategoryStat[];
  grandDefaultRate: number;
  grandNearingRevocation: number;
  grandRevoked: number;
  // RESALE: resaleActive: number;
}

const TEAL  = "#0f9699";
const TEAL2 = "#5de4e6";
const GRAY  = "#e5e7eb";
const AMBER = "#f59e0b";
const RED   = "#ef4444";
// RESALE: const INDIGO = "#6366f1";

function shorten(s: string, max = 13) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function currency(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(0)}K`;
  return `KES ${n}`;
}

export function AnalyticsCharts({
  eventStats,
  grandRevenue,
  grandCollected,
  grandOutstanding,
  grandSold,
  grandAvailable,
  grandComplimentaryIssued,
  categoryStats,
  grandDefaultRate,
  grandNearingRevocation,
  grandRevoked,
  // RESALE: resaleActive,
}: Props) {
  const collectionPct = grandRevenue > 0 ? Math.round((grandCollected / grandRevenue) * 100) : 0;

  /* Donut — tickets */
  const ticketDonut = [
    { name: "Sold",          value: grandSold },
    { name: "Complimentary", value: grandComplimentaryIssued },
    { name: "Remaining",     value: Math.max(0, grandAvailable - grandSold) },
  ];

  /* Donut — revenue */
  const revenueDonut = [
    { name: "Collected",   value: grandCollected },
    { name: "Outstanding", value: grandOutstanding },
  ];

  /* Donut — default rate */
  const defaultDonut = [
    { name: "Defaulted", value: grandDefaultRate },
    { name: "Healthy",   value: Math.max(0, 100 - grandDefaultRate) },
  ];

  /* Bar chart — revenue vs collected per event */
  const revenueBarData = eventStats.map((e) => ({
    name:      shorten(e.name),
    Revenue:   e.revenue,
    Collected: e.collected,
  }));

  /* Bar chart — tickets by category (sold vs remaining) */
  const categoryBarData = categoryStats.map((c) => ({
    name:      shorten(c.name),
    fullLabel: `${c.name} · ${c.eventName}`,
    Sold:      c.sold,
    Remaining: Math.max(0, c.available - c.sold),
  }));

  /* Bar chart — default rate per category (only categories with orders) */
  const defaultRateData = categoryStats
    .filter((c) => c.totalOrders > 0)
    .map((c) => ({
      name:       shorten(c.name),
      fullLabel:  `${c.name} · ${c.eventName}`,
      "Default %": Math.round((c.defaulted / c.totalOrders) * 100),
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-xs">
        <p className="font-bold text-gray-900 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color ?? p.fill }}>
            {p.name}:{" "}
            {typeof p.value === "number" && p.name.includes("%")
              ? `${p.value}%`
              : typeof p.value === "number" && (p.name === "Revenue" || p.name === "Collected")
              ? `KES ${Number(p.value).toLocaleString()}`
              : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Row 1: Revenue KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total revenue",    value: `KES ${grandRevenue.toLocaleString()}`,   sub: "at full price",       color: "text-gray-900" },
          { label: "Collected",        value: `KES ${grandCollected.toLocaleString()}`, sub: "payments received",   color: "text-primary-600" },
          { label: "Outstanding",      value: `KES ${grandOutstanding.toLocaleString()}`, sub: "remaining on active installments", color: "text-amber-500" },
          { label: "Collection rate",  value: `${collectionPct}%`,                      sub: "of expected",         color: collectionPct >= 80 ? "text-emerald-600" : "text-amber-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
            <p className={`mt-2 text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Revenue bar chart + donuts ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-black text-gray-900">Revenue vs Collected</h3>
          <p className="mb-5 text-xs text-gray-400">Per event breakdown</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueBarData} barGap={4} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={currency} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="Revenue"   fill={TEAL2} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Collected" fill={TEAL}  radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-5">
          {/* Ticket sales donut */}
          <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-black text-gray-900">Ticket sales</h3>
            <p className="mb-3 text-xs text-gray-400">{grandSold + grandComplimentaryIssued} of {grandAvailable} issued</p>
            <div className="flex items-center gap-4">
              <PieChart width={90} height={90}>
                <Pie data={ticketDonut} cx={40} cy={40} innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                  <Cell fill={TEAL} />
                  <Cell fill={TEAL2} />
                  <Cell fill={GRAY} />
                </Pie>
              </PieChart>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} />
                  <span className="text-gray-600">Sold <strong>{grandSold}</strong></span>
                </div>
                {grandComplimentaryIssued > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL2 }} />
                    <span className="text-gray-600">Complimentary <strong>{grandComplimentaryIssued}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: GRAY }} />
                  <span className="text-gray-600">Remaining <strong>{Math.max(0, grandAvailable - grandSold)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue collection donut */}
          <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-black text-gray-900">Collection rate</h3>
            <p className="mb-3 text-xs text-gray-400">{collectionPct}% of expected revenue</p>
            <div className="flex items-center gap-4">
              <PieChart width={90} height={90}>
                <Pie data={revenueDonut} cx={40} cy={40} innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                  <Cell fill={TEAL} />
                  <Cell fill={AMBER} />
                </Pie>
              </PieChart>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} />
                  <span className="text-gray-600">Collected <strong>KES {grandCollected.toLocaleString()}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} />
                  <span className="text-gray-600">Outstanding <strong>KES {grandOutstanding.toLocaleString()}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Risk & Health KPI cards ── */}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Risk & Health</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Default rate */}
          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Default rate</p>
            <div className="mt-2 flex items-end gap-3">
              <p className={`text-2xl font-black ${grandDefaultRate === 0 ? "text-emerald-600" : grandDefaultRate < 10 ? "text-amber-500" : "text-red-500"}`}>
                {grandDefaultRate}%
              </p>
              <PieChart width={42} height={42} className="mb-0.5">
                <Pie data={defaultDonut} cx={18} cy={18} innerRadius={12} outerRadius={19} dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                  <Cell fill={grandDefaultRate === 0 ? "#10b981" : grandDefaultRate < 10 ? AMBER : RED} />
                  <Cell fill={GRAY} />
                </Pie>
              </PieChart>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">of orders defaulted</p>
          </div>

          {/* Nearing revocation */}
          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${grandNearingRevocation > 0 ? "border-orange-200" : "border-gray-100"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nearing revocation</p>
            <p className={`mt-2 text-2xl font-black ${grandNearingRevocation > 0 ? "text-orange-500" : "text-emerald-600"}`}>
              {grandNearingRevocation}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">orders past grace period</p>
          </div>

          {/* Revoked tickets */}
          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${grandRevoked > 0 ? "border-red-200" : "border-gray-100"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Revoked tickets</p>
            <p className={`mt-2 text-2xl font-black ${grandRevoked > 0 ? "text-red-500" : "text-emerald-600"}`}>
              {grandRevoked}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">non-payment revocations</p>
          </div>

          {/* RESALE:
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">In resale market</p>
            <p className="mt-2 text-2xl font-black text-indigo-500">{resaleActive}</p>
            <p className="mt-0.5 text-xs text-gray-400">active listings</p>
          </div>
          */}
        </div>
      </div>

      {/* ── Row 4: Tickets by category + Default rate by category ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Tickets sold per category */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-black text-gray-900">Tickets by category</h3>
          <p className="mb-5 text-xs text-gray-400">Sold vs remaining per ticket tier</p>
          {categoryBarData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">No categories yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryBarData} barGap={4} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="Sold"      fill={TEAL}  radius={[6, 6, 0, 0]} />
                <Bar dataKey="Remaining" fill={GRAY}  radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Default rate per category */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-black text-gray-900">Default rate by category</h3>
          <p className="mb-5 text-xs text-gray-400">% of orders that defaulted</p>
          {defaultRateData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">No orders yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={defaultRateData} barSize={20} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Default %" fill={AMBER} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 5: Tickets sold per event horizontal bars ── */}
      {eventStats.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-black text-gray-900">Tickets sold per event</h3>
          <p className="mb-5 text-xs text-gray-400">Sold vs total available</p>
          <div className="space-y-4">
            {eventStats.map((e) => {
              const pct = e.available > 0 ? Math.round((e.sold / e.available) * 100) : 0;
              return (
                <div key={e.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700 truncate max-w-[60%]">{e.name}</span>
                    <span className="text-gray-400">{e.sold} / {e.available} · <strong className="text-gray-700">{pct}%</strong></span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-2.5 rounded-full bg-primary-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row 6: Revocation & Resale status per event ── */}
      {categoryStats.some((c) => c.defaulted > 0 || c.revoked > 0) && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-black text-gray-900">Defaults & revocations by category</h3>
          <p className="mb-5 text-xs text-gray-400">Categories with payment issues</p>
          <div className="space-y-3">
            {categoryStats
              .filter((c) => c.totalOrders > 0)
              .map((c) => {
                const rate = Math.round((c.defaulted / c.totalOrders) * 100);
                return (
                  <div key={c.categoryId} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="min-w-0">
                          <span className="font-semibold text-gray-700 truncate">{c.name}</span>
                          <span className="ml-1.5 text-gray-400 truncate">· {c.eventName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2 text-xs">
                          {c.revoked > 0 && (
                            <span className="flex items-center gap-1 text-red-500 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {c.revoked} revoked
                            </span>
                          )}
                          {c.defaulted - c.revoked > 0 && (
                            <span className="flex items-center gap-1 text-orange-500 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                              {c.defaulted - c.revoked} nearing
                            </span>
                          )}
                          <span className="text-gray-400">{rate}% rate</span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${rate}%`,
                            background: rate === 0 ? "#10b981" : rate < 10 ? AMBER : RED,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
