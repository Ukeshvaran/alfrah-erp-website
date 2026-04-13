import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import api from '../services/api';

interface AnalyticsData {
  team_member_id: number;
  team_member_name: string;
  team_name: string;
  total_revenue: number;
  total_sales: number;
  days_present: number;
  total_days: number;
}

interface AnalyticsDashboardProps {
  onBack: () => void;
}

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, [startDate, endDate]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/analytics?start_date=${startDate}&end_date=${endDate}`);
      setAnalyticsData(response.data);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTopPerformers = () => {
    return [...analyticsData]
      .sort((a, b) => {
        if (b.total_revenue !== a.total_revenue) {
          return b.total_revenue - a.total_revenue;
        }
        return b.total_sales - a.total_sales;
      })
      .slice(0, 3);
  };

  const getTeamStats = () => {
    const teamMap: Record<string, { revenue: number; sales: number; members: number }> = {};

    analyticsData.forEach(d => {
      const t = d.team_name || 'Unnamed team';
      if (!teamMap[t]) {
        teamMap[t] = { revenue: 0, sales: 0, members: 0 };
      }
      teamMap[t].revenue += d.total_revenue;
      teamMap[t].sales += d.total_sales;
      teamMap[t].members += 1;
    });

    return Object.entries(teamMap)
      .map(([name, stats]) => ({ teamName: name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const topPerformers = getTopPerformers();
  const teamStats = getTeamStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-fuchsia-500/20 mb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-slate-200 shadow-sm transition hover:bg-cyan-500 hover:text-slate-950"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-4xl font-semibold text-white">Overall Analytics</h1>
                <p className="mt-2 text-sm text-slate-400">Performance insights across all teams</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-inner shadow-slate-950/20">
              <label className="block text-sm font-medium text-slate-400">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-inner shadow-slate-950/20">
              <label className="block text-sm font-medium text-slate-400">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-[32px] bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/30 border border-white/10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-amber-500 text-slate-950">
                <Trophy size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Top Performers</h2>
                <p className="text-sm text-slate-400">Best revenue contributors</p>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : topPerformers.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No data available for this date range</div>
            ) : (
              <div className="space-y-4">
                {topPerformers.map((performer, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
                      index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-500' : 'bg-fuchsia-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{performer.team_member_name}</h3>
                      <p className="text-sm text-slate-400">Team: {performer.team_name || 'Unnamed team'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-cyan-300">₹{performer.total_revenue.toFixed(2)}</p>
                      <p className="text-sm text-slate-400">{performer.total_sales} sales</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[32px] bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/30 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Team Performance</h2>
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : teamStats.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No data available</div>
            ) : (
              <div className="space-y-3">
                {teamStats.map((team, index) => (
                  <div
                    key={index}
                    className={`rounded-3xl p-4 ${index === 0 ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20' : 'bg-slate-950/80 border border-white/10 text-slate-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{team.teamName}</h3>
                      {index === 0 && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          Best Team
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-slate-300">Revenue</p>
                        <p className="font-semibold text-emerald-300">₹{team.revenue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-300">Sales</p>
                        <p className="font-semibold text-cyan-300">{team.sales}</p>
                      </div>
                      <div>
                        <p className="text-slate-300">Members</p>
                        <p className="font-semibold text-fuchsia-300">{team.members}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}