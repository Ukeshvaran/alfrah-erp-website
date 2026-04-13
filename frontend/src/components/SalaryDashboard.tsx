import { useEffect, useState } from 'react';
import { Calendar, Save } from 'lucide-react';
import api from '../services/api';

interface TeamMember {
  id: number;
  name: string;
}

interface SaleEntry {
  id: string;
  amount: string;
  packType: string;
}

interface PerformanceData {
  team_member_id: number;
  revenue?: number;
  sales?: number;
  salary?: number;
  salaryPaid?: number;
  monthlyRevenue?: number;
  monthlySales?: number;
  eligibleForSalary?: boolean;
  achievedAmount?: number;
  remainingToTarget?: number;
  cycleStart?: string;
  cycleEnd?: string;
  attendance: boolean;
  notes: string;
  incentiveMode: 'monthly' | 'daily';
  dailyGiven: boolean;
  salesEntries: SaleEntry[];
}

interface SalaryCycleItem {
  cycleStart: string;
  cycleEnd: string;
  cycleRevenue: number;
  cycleSales: number;
  incentiveTotal: number;
  incentiveAddedToSalary: number;
  salaryEarned: number;
  salaryPaid: number;
  salaryBalance: number;
}

interface SalaryCycleGroup {
  team_member_id: number;
  team_member_name: string;
  cycles: SalaryCycleItem[];
}

const createDefaultPerformanceData = (memberId: number): PerformanceData => ({
  team_member_id: memberId,
  revenue: 0,
  sales: 0,
  salary: 0,
  salaryPaid: 0,
  monthlyRevenue: 0,
  monthlySales: 0,
  eligibleForSalary: false,
  achievedAmount: 0,
  remainingToTarget: 70000,
  attendance: true,
  notes: '',
  incentiveMode: 'monthly',
  dailyGiven: false,
  salesEntries: []
});

export function SalaryDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [performanceData, setPerformanceData] = useState<Record<number, PerformanceData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salaryCycles, setSalaryCycles] = useState<SalaryCycleGroup[]>([]);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  useEffect(() => {
    if (teamMembers.length > 0) {
      loadPerformanceData();
    }
  }, [selectedDate, teamMembers]);

  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/team-members');
      setTeamMembers(response.data);
    } catch (err) {
      console.error('Error loading team members:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/performance?date=${selectedDate}`);
      const dataMap: Record<number, PerformanceData> = {};
      response.data.forEach((item: PerformanceData) => {
        dataMap[item.team_member_id] = {
          ...createDefaultPerformanceData(item.team_member_id),
          ...item,
          salesEntries: item.salesEntries || []
        };
      });
      setPerformanceData(dataMap);
      await loadSalaryCycles();
    } catch (err) {
      console.error('Error loading salary data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSalaryCycles = async () => {
    try {
      const response = await api.get('/api/salary-cycles');
      setSalaryCycles(response.data || []);
    } catch (err) {
      console.error('Error loading salary cycles:', err);
    }
  };

  const updatePerformanceData = (memberId: number, field: keyof Omit<PerformanceData, 'salesEntries'>, value: any) => {
    setPerformanceData(prev => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || createDefaultPerformanceData(memberId)),
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.values(performanceData).map(data => ({
        ...data,
        date: selectedDate
      }));
      await api.post('/api/performance', updates);
      alert('Salary and incentive data saved successfully!');
      await loadPerformanceData();
      await loadSalaryCycles();
    } catch (err) {
      console.error('Error saving salary data:', err);
      alert('Failed to save salary data');
    } finally {
      setSaving(false);
    }
  };

  const totalSalaryEarned = Object.values(performanceData).reduce((sum, d) => sum + (d.salary || 0), 0);
  const totalSalaryPaid = Object.values(performanceData).reduce((sum, d) => sum + (Number(d.salaryPaid) || 0), 0);

  return (
    <div className="min-h-screen text-slate-100">
      <div className="w-full px-6 py-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-fuchsia-500/20 mb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-white">Salary & Incentive</h1>
              <p className="mt-2 text-sm text-slate-300">Manage salary cycle details, paid salary and incentive mode per member.</p>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Salary Data'}
            </button>
          </div>

          <div className="mt-6">
            <div className="inline-flex items-center gap-3 rounded-3xl bg-slate-900/70 px-4 py-3">
              <Calendar className="text-cyan-300" size={20} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-[28px] bg-gradient-to-br from-violet-500 to-fuchsia-600 p-6 text-white shadow-xl shadow-fuchsia-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-violet-100/90 mb-2">Total Salary Earned</h3>
            <p className="text-3xl font-semibold">₹{totalSalaryEarned.toFixed(2)}</p>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-cyan-600 p-6 text-white shadow-xl shadow-cyan-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-100/90 mb-2">Total Salary Paid</h3>
            <p className="text-3xl font-semibold">₹{totalSalaryPaid.toFixed(2)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] bg-slate-950/95 text-slate-100 shadow-2xl shadow-fuchsia-500/10">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Cycle Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Achieved</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Eligible</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Salary Earned</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Salary Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => {
                    const data = performanceData[member.id] || createDefaultPerformanceData(member.id);
                    return (
                      <tr key={member.id} className="rounded-[28px] bg-slate-900/80 shadow-sm shadow-slate-950/20 hover:bg-slate-900">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">{member.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {(data.cycleStart && data.cycleEnd) ? `${data.cycleStart} to ${data.cycleEnd}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-sky-300">{data.monthlySales || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-300">₹{(data.achievedAmount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-300">₹{(data.remainingToTarget || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.eligibleForSalary ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'}`}>
                            {data.eligibleForSalary ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-violet-300">₹{(data.salary || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={data.salaryPaid || 0}
                            onChange={(e) => updatePerformanceData(member.id, 'salaryPaid', parseFloat(e.target.value || '0'))}
                            className="w-28 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-[32px] bg-slate-950/95 text-slate-100 shadow-2xl shadow-fuchsia-500/10">
          <div className="border-b border-white/10 p-6">
            <h2 className="text-2xl font-semibold text-white">Member-wise Salary Cycle History</h2>
            <p className="mt-2 text-sm text-slate-400">Cycle salary already includes incentives as per daily/monthly settings.</p>
          </div>
          <div className="p-6">
            {salaryCycles.length === 0 ? (
              <div className="text-sm text-slate-400">No cycle records yet.</div>
            ) : (
              <div className="space-y-6">
                {salaryCycles.map((memberGroup) => (
                  <div key={memberGroup.team_member_id} className="rounded-2xl border border-white/10 bg-slate-900/60">
                    <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
                      {memberGroup.team_member_name}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Cycle</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Sales</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Revenue</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Incentive Total</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Incentive Added</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Salary Earned</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Salary Paid</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-400">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberGroup.cycles.map((cycle, idx) => (
                            <tr key={`${memberGroup.team_member_id}-${idx}`} className="border-t border-white/10">
                              <td className="px-4 py-3 text-sm text-slate-200">{cycle.cycleStart} to {cycle.cycleEnd}</td>
                              <td className="px-4 py-3 text-sm text-sky-300">{cycle.cycleSales}</td>
                              <td className="px-4 py-3 text-sm text-emerald-300">₹{cycle.cycleRevenue.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-cyan-300">₹{cycle.incentiveTotal.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-cyan-200">₹{cycle.incentiveAddedToSalary.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-violet-300">₹{cycle.salaryEarned.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-green-300">₹{cycle.salaryPaid.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-orange-300">₹{cycle.salaryBalance.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
