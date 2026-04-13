import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BarChart3, CalendarClock, PartyPopper, Sparkles, Users, X } from 'lucide-react';
import api from '../services/api';

interface PerformerRow {
  member_name: string;
  team_name: string;
  revenue: number;
  sales: number;
}

interface TeamRow {
  team_name: string;
  revenue: number;
  sales: number;
}

interface MonthRev {
  year: number;
  month: number;
  label: string;
  total_revenue: number;
}

interface TodaySaleRow {
  id: number;
  member_name: string;
  team_name: string;
  amount: number;
  pack_type: string;
  created_at: string | null;
}

interface DashboardPayload {
  performers_today: PerformerRow[];
  teams_today: TeamRow[];
  performers_this_month: PerformerRow[];
  teams_this_month: TeamRow[];
  total_revenue_today: number;
  total_revenue_month: number;
  total_sales_today: number;
  total_sales_month: number;
  revenue_by_month: MonthRev[];
  today_sales: TodaySaleRow[];
}

interface NewSale {
  id: number;
  member_name: string;
  team_name: string;
  amount: number;
  pack_type: string;
  created_at: string | null;
}

function playSaleChime() {
  try {
    const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ACtx) return;
    const ctx = new ACtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(740, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.24);
    setTimeout(() => ctx.close(), 350);
  } catch {
    /* ignore */
  }
}

function formatLocalDateTime() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

function useLiveClock(intervalMs = 1000) {
  const [label, setLabel] = useState(formatLocalDateTime);
  useEffect(() => {
    const id = window.setInterval(() => setLabel(formatLocalDateTime()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return label;
}

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.4}s`,
    duration: `${1.8 + Math.random() * 1.2}s`,
    hue: 180 + Math.random() * 160,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 h-2 w-2 animate-confetti rounded-sm opacity-90"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: `hsl(${p.hue} 90% 60%)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-8px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(220px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

function RankingPanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[22rem] flex-col rounded-[28px] border border-white/10 bg-slate-950/90 shadow-xl shadow-slate-950/40 md:min-h-[26rem]">
      <div className="shrink-0 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 text-slate-300">
          {icon}
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">{children}</div>
    </div>
  );
}

function PerformerTable({ rows, emptyLabel }: { rows: PerformerRow[]; emptyLabel: string }) {
  if (!rows.length) {
    return <p className="px-3 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 z-[1] bg-slate-950/95 backdrop-blur-sm">
        <tr className="text-[10px] uppercase tracking-wider text-slate-500">
          <th className="px-3 py-2">#</th>
          <th className="px-3 py-2">Member</th>
          <th className="px-3 py-2">Team</th>
          <th className="px-3 py-2 text-right">Sales</th>
          <th className="px-3 py-2 text-right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <tr key={`${p.member_name}-${p.team_name}-${i}`} className="border-t border-white/5 text-slate-300">
            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{i + 1}</td>
            <td className="px-3 py-2.5 font-medium text-white">{p.member_name}</td>
            <td className="max-w-[8rem] truncate px-3 py-2.5 text-slate-400" title={p.team_name}>
              {p.team_name}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-400">{p.sales}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-cyan-300">
              ₹{p.revenue.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamTotalsTable({ rows, emptyLabel }: { rows: TeamRow[]; emptyLabel: string }) {
  if (!rows.length) {
    return <p className="px-3 py-8 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 z-[1] bg-slate-950/95 backdrop-blur-sm">
        <tr className="text-[10px] uppercase tracking-wider text-slate-500">
          <th className="px-3 py-2">#</th>
          <th className="px-3 py-2">Team</th>
          <th className="px-3 py-2 text-right">Sales</th>
          <th className="px-3 py-2 text-right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => (
          <tr key={`${t.team_name}-${i}`} className="border-t border-white/5 text-slate-300">
            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{i + 1}</td>
            <td className="px-3 py-2.5 font-medium text-white">{t.team_name}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-400">{t.sales}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-fuchsia-200">
              ₹{t.revenue.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminDashboard() {
  const clockLabel = useLiveClock();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sinceRef = useRef<string>(new Date().toISOString());
  const queueRef = useRef<NewSale[]>([]);
  const modalOpenRef = useRef(false);
  const [notify, setNotify] = useState<NewSale | null>(null);

  const tryShowNext = useCallback(() => {
    if (modalOpenRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    modalOpenRef.current = true;
    playSaleChime();
    setNotify(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DashboardPayload>('/api/admin/dashboard');
      setData(res.data);
      setError('');
    } catch (e) {
      console.error(e);
      setError('Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    sinceRef.current = new Date().toISOString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.get<{ sales: NewSale[] }>(
          `/api/admin/new-sales?since=${encodeURIComponent(sinceRef.current)}`
        );
        if (cancelled || !res.data.sales?.length) return;
        const sorted = [...res.data.sales].sort((a, b) => {
          const ta = a.created_at || '';
          const tb = b.created_at || '';
          return ta.localeCompare(tb);
        });
        sorted.forEach((s) => queueRef.current.push(s));
        const last = sorted[sorted.length - 1];
        if (last?.created_at) sinceRef.current = last.created_at;
        else sinceRef.current = new Date().toISOString();
        tryShowNext();
        await load();
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(poll, 4000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tryShowNext, load]);

  useEffect(() => {
    if (notify === null) {
      modalOpenRef.current = false;
      const t = window.setTimeout(() => tryShowNext(), 280);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => setNotify(null), 6500);
    return () => clearTimeout(t);
  }, [notify, tryShowNext]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        Loading admin dashboard…
      </div>
    );
  }

  if (error && !data) {
    return <div className="p-8 text-center text-rose-300">{error}</div>;
  }

  const d = data!;
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="min-h-screen px-4 py-8 text-slate-100">
      {notify && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-fuchsia-400/40 bg-gradient-to-br from-slate-900 via-indigo-950 to-fuchsia-950 p-8 shadow-2xl shadow-fuchsia-500/30">
            <Confetti />
            <button
              type="button"
              onClick={() => {
                modalOpenRef.current = false;
                setNotify(null);
              }}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-200 hover:bg-white/20"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="relative z-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 text-slate-950 shadow-lg">
                <PartyPopper size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">New sale</h2>
              <p className="mt-4 text-lg text-slate-200">
                New sale added by <span className="font-semibold text-cyan-300">{notify.member_name}</span>{' '}
                from team <span className="font-semibold text-fuchsia-300">{notify.team_name}</span>.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                {notify.pack_type} · ₹{notify.amount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Admin overview</h1>
            <p className="mt-1 text-sm text-slate-400">Rankings from daily performance (excludes admin accounts)</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-2.5 text-sm text-slate-200 tabular-nums shadow-inner shadow-black/20"
              title="Current date and time in your browser timezone"
            >
              <CalendarClock size={18} className="shrink-0 text-cyan-300" />
              <span>{clockLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-cyan-200">
              <Sparkles size={18} />
              Listening for new sales…
            </div>
          </div>
        </div>

        {/* Today: performers | teams */}
        <section aria-label="Today rankings">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Today</h2>
          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            <RankingPanel
              title="Performers today"
              subtitle="One row per member with saved performance for today · ordered by revenue"
              icon={<BarChart3 className="text-cyan-300" size={20} />}
            >
              <PerformerTable
                rows={d.performers_today ?? []}
                emptyLabel="No performance saved for today yet."
              />
            </RankingPanel>
            <RankingPanel
              title="Teams today"
              subtitle="All teams · total revenue and sales for today"
              icon={<Users className="text-fuchsia-300" size={20} />}
            >
              <TeamTotalsTable rows={d.teams_today ?? []} emptyLabel="No team totals for today yet." />
            </RankingPanel>
          </div>
        </section>

        {/* Month: performers | teams */}
        <section aria-label="Month rankings">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{monthLabel}</h2>
          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            <RankingPanel
              title="Performers this month"
              subtitle="All members with activity in the current calendar month"
              icon={<BarChart3 className="text-sky-300" size={20} />}
            >
              <PerformerTable
                rows={d.performers_this_month ?? []}
                emptyLabel="No performance recorded for this month yet."
              />
            </RankingPanel>
            <RankingPanel
              title="Teams this month"
              subtitle="All teams · MTD totals"
              icon={<Users className="text-amber-300" size={20} />}
            >
              <TeamTotalsTable rows={d.teams_this_month ?? []} emptyLabel="No team totals for this month yet." />
            </RankingPanel>
          </div>
        </section>

        {/* Revenue review */}
        <section className="rounded-[28px] border border-white/10 bg-slate-950/90 p-6 shadow-xl" aria-label="Revenue review">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Revenue review</h2>
              <p className="mt-1 text-xs text-slate-500">Rollups from daily performance · same scope as rankings above</p>
            </div>
          </div>
          <div className="mb-8 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Total sales (count)</th>
                  <th className="px-4 py-3 text-right">Total revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium text-white">Today</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{d.total_sales_today ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-300">
                    ₹{(d.total_revenue_today ?? 0).toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-3 font-medium text-white">This month (MTD)</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{d.total_sales_month ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-300">
                    ₹{(d.total_revenue_month ?? 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Total revenue by calendar month</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {(d.revenue_by_month ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No revenue recorded</p>
            ) : (
              (d.revenue_by_month ?? []).map((m) => (
                <div
                  key={m.label}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <span className="text-slate-300">{m.label}</span>
                  <span className="font-semibold text-emerald-300">₹{m.total_revenue.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Sale line items — end of page */}
        <section className="rounded-[28px] border border-white/10 bg-slate-950/90 p-6 shadow-xl" aria-label="Sales today">
          <h2 className="text-lg font-semibold text-white">Sales today (line items)</h2>
          <p className="mb-4 text-xs text-slate-500">Individual sale entries with amount &gt; 0</p>
          <div className="max-h-[28rem] overflow-x-auto overflow-y-auto rounded-2xl border border-white/5">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-950/95 backdrop-blur-sm">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Pack</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(d.today_sales ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No sale line items recorded for today
                    </td>
                  </tr>
                ) : (
                  (d.today_sales ?? []).map((s) => (
                    <tr key={s.id} className="border-t border-white/5 text-slate-300">
                      <td className="px-4 py-2.5 font-medium text-white">{s.member_name}</td>
                      <td className="px-4 py-2.5">{s.team_name}</td>
                      <td className="px-4 py-2.5">{s.pack_type}</td>
                      <td className="px-4 py-2.5 text-right text-cyan-300">₹{s.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
