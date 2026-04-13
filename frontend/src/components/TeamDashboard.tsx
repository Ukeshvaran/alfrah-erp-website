import { useState, useEffect, Fragment } from 'react';
import { Calendar, Plus, Trash2, Save, BarChart3, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  couponCode?: string;
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
  salaryPaid?: number;
  salary?: number;
  attendance: boolean;
  notes: string;
  incentiveMode: 'monthly' | 'daily';
  dailyGiven: boolean;
  salesEntries: SaleEntry[];
}

const createEmptySaleEntry = (): SaleEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  amount: '',
  packType: 'Origin'
});

const createDefaultPerformanceData = (memberId: number): PerformanceData => ({
  team_member_id: memberId,
  revenue: 0,
  sales: 0,
  salaryPaid: 0,
  attendance: true,
  notes: '',
  incentiveMode: 'monthly',
  dailyGiven: false,
  salesEntries: []
});

const calculateMemberTotals = (data: PerformanceData) => {
  const totalRevenue = (data.salesEntries || []).reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
  const totalSales = (data.salesEntries || []).length;
  const incentiveRate = totalSales === 1 ? 0.05 : totalSales === 2 ? 0.06 : totalSales === 3 ? 0.07 : totalSales >= 4 ? 0.08 : 0;
  const incentiveAmount = totalRevenue * incentiveRate;
  const addIncentive = data.incentiveMode === 'monthly' || !data.dailyGiven;

  return {
    totalRevenue,
    totalSales,
    incentiveRate,
    incentiveAmount,
    incentiveAddedToSalary: addIncentive ? incentiveAmount : 0
  };
};

export function TeamDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [performanceData, setPerformanceData] = useState<Record<number, PerformanceData>>({});
  const [expandedMembers, setExpandedMembers] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCouponCode, setNewMemberCouponCode] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    loadTeamMembers();
  }, []);

  useEffect(() => {
    if (teamMembers.length > 0) {
      loadPerformanceData();
      const expanded: Record<number, boolean> = {};
      teamMembers.forEach((member) => {
        expanded[member.id] = true;
      });
      setExpandedMembers(expanded);
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
    } catch (err) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;

    try {
      const response = await api.post('/api/team-members', {
        name: newMemberName.trim(),
        role: 'Team Member',
        couponCode: newMemberCouponCode.trim()
      });

      setTeamMembers([...teamMembers, response.data]);
      setNewMemberName('');
      setNewMemberCouponCode('');
      setShowAddMember(false);
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add team member');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      await api.delete(`/api/team-members/${memberId}`);
      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove team member');
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

  const addSaleEntry = (memberId: number) => {
    setPerformanceData(prev => {
      const current = prev[memberId] || createDefaultPerformanceData(memberId);
      return {
        ...prev,
        [memberId]: {
          ...current,
          salesEntries: [...(current.salesEntries || []), createEmptySaleEntry()]
        }
      };
    });
  };

  const updateSaleEntry = (memberId: number, entryId: string, field: keyof SaleEntry, value: any) => {
    setPerformanceData(prev => {
      const current = prev[memberId] || createDefaultPerformanceData(memberId);
      return {
        ...prev,
        [memberId]: {
          ...current,
          salesEntries: (current.salesEntries || []).map(entry =>
            entry.id === entryId ? { ...entry, [field]: value } : entry
          )
        }
      };
    });
  };

  const removeSaleEntry = (memberId: number, entryId: string) => {
    setPerformanceData(prev => {
      const current = prev[memberId] || createDefaultPerformanceData(memberId);
      return {
        ...prev,
        [memberId]: {
          ...current,
          salesEntries: (current.salesEntries || []).filter(entry => entry.id !== entryId)
        }
      };
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.values(performanceData).map(data => {
        const totals = calculateMemberTotals(data);
        return {
          ...data,
          date: selectedDate,
          revenue: totals.totalRevenue,
          sales: totals.totalSales
        };
      });

      await api.post('/api/performance', updates);
      alert('Performance data saved successfully!');
      await loadPerformanceData();
    } catch (err) {
      console.error('Error saving data:', err);
      alert('Failed to save performance data');
    } finally {
      setSaving(false);
    }
  };

  const toggleMemberExpansion = (memberId: number) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const handleDownloadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      setReportError('Both start and end dates are required');
      return;
    }

    setReportError('');
    setReportLoading(true);

    try {
      const response = await api.get('/api/report', {
        params: {
          start_date: reportStartDate,
          end_date: reportEndDate
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `team-report-${reportStartDate}-${reportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowReportModal(false);
    } catch (err) {
      console.error('Error generating report:', err);
      setReportError('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const calculateSummary = () => {
    const values = Object.values(performanceData);
    const totalRevenue = values.reduce((sum, d) => sum + calculateMemberTotals(d).totalRevenue, 0);
    const totalSales = values.reduce((sum, d) => sum + calculateMemberTotals(d).totalSales, 0);
    const presentCount = values.filter(d => d.attendance).length;
    const attendanceRate = teamMembers.length > 0 ? (presentCount / teamMembers.length) * 100 : 0;

    return {
      totalRevenue,
      avgRevenue: teamMembers.length > 0 ? totalRevenue / teamMembers.length : 0,
      totalSales,
      avgSales: teamMembers.length > 0 ? totalSales / teamMembers.length : 0,
      attendanceRate
    };
  };

  const summary = calculateSummary();

  return (
    <div className="min-h-screen text-slate-100">
      <div className="w-full px-6 py-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-2xl shadow-fuchsia-500/20 backdrop-blur-xl mb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-white">Team Dashboard</h1>
              <p className="mt-2 text-sm text-slate-300">Manage performance, sales, and attendance with clarity.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110"
              >
                <BarChart3 size={20} />
                Download Report
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-3xl bg-slate-900/70 px-4 py-3">
              <Calendar className="text-cyan-300" size={20} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <Plus size={20} />
              Add Team Member
            </button>
          </div>

          {showAddMember && (
            <div className="mt-4 rounded-[28px] border border-white/10 bg-slate-950/80 p-4 shadow-inner shadow-slate-950/20 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Member name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
              <input
                type="text"
                placeholder="Coupon code"
                value={newMemberCouponCode}
                onChange={(e) => setNewMemberCouponCode(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
              <button
                onClick={handleAddMember}
                className="rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:bg-fuchsia-400"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white shadow-xl shadow-cyan-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-100/90 mb-2">Total Revenue</h3>
            <p className="text-3xl font-semibold">₹{summary.totalRevenue.toFixed(2)}</p>
            <p className="mt-3 text-xs text-cyan-100/80">Avg: ₹{summary.avgRevenue.toFixed(2)}</p>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-sky-500 to-indigo-600 p-6 text-white shadow-xl shadow-sky-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-sky-100/90 mb-2">Total Sales</h3>
            <p className="text-3xl font-semibold">{summary.totalSales}</p>
            <p className="mt-3 text-xs text-sky-100/80">Avg: {summary.avgSales.toFixed(1)}</p>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white shadow-xl shadow-pink-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-purple-100/90 mb-2">Attendance Rate</h3>
            <p className="text-3xl font-semibold">{summary.attendanceRate.toFixed(1)}%</p>
            <p className="mt-3 text-xs text-purple-100/80">{Object.values(performanceData).filter(d => d.attendance).length} present</p>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-orange-400 to-amber-500 p-6 text-white shadow-xl shadow-orange-500/20">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-orange-50/90 mb-2">Team Size</h3>
            <p className="text-3xl font-semibold">{teamMembers.length}</p>
            <p className="mt-3 text-xs text-orange-50/80">Active members</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] bg-slate-950/95 text-slate-100 shadow-2xl shadow-fuchsia-500/10">
          <div className="p-6 border-b border-white/10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Performance Data Entry</h2>
              <p className="mt-2 text-sm text-slate-400">Capture revenue, sales, and attendance for your team.</p>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : teamMembers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No team members yet. Add your first team member to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="px-6 py-3"></th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Coupon Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Incentive</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Daily Given</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Incentive Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Attendance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(member => {
                    const data = performanceData[member.id] || createDefaultPerformanceData(member.id);
                    const totals = calculateMemberTotals(data);
                    const isExpanded = expandedMembers[member.id] ?? true;
                    return (
                      <Fragment key={member.id}>
                        <tr className="rounded-[28px] bg-slate-900/80 shadow-sm shadow-slate-950/20 hover:bg-slate-900">
                          <td className="px-6 py-4 whitespace-nowrap align-top">
                            <button
                              onClick={() => toggleMemberExpansion(member.id)}
                              className="rounded-full bg-slate-800 p-2 text-slate-300 transition hover:bg-cyan-500 hover:text-white"
                              aria-label={isExpanded ? 'Collapse sales' : 'Expand sales'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="text-slate-600" size={18} />
                              ) : (
                                <ChevronRight className="text-slate-600" size={18} />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">{member.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-300">{member.couponCode || '-'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <select
                                value={data.incentiveMode}
                                onChange={(e) => updatePerformanceData(member.id, 'incentiveMode', e.target.value as 'monthly' | 'daily')}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                              >
                                <option value="monthly">Monthly</option>
                                <option value="daily">Daily</option>
                              </select>
                              <div className="text-xs text-slate-500">
                                {Math.round(totals.incentiveRate * 100)}% incentive
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {data.incentiveMode === 'daily' ? (
                              <button
                                type="button"
                                onClick={() => updatePerformanceData(member.id, 'dailyGiven', !data.dailyGiven)}
                                className={`w-full rounded-2xl px-3 py-2 text-sm font-semibold transition ${data.dailyGiven ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                              >
                                {data.dailyGiven ? 'Yes' : 'No'}
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-cyan-300">₹{totals.incentiveAmount.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">Added: ₹{totals.incentiveAddedToSalary.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-emerald-300">₹{totals.totalRevenue.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-sky-300">{totals.totalSales}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => updatePerformanceData(member.id, 'attendance', !data.attendance)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-emerald-500 hover:text-white"
                            >
                              {data.attendance ? (
                                <CheckCircle size={20} />
                              ) : (
                                <XCircle size={20} />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => addSaleEntry(member.id)}
                                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                              >
                                Add Sale
                              </button>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-3 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500 hover:text-white"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={10} className="px-6 py-4">
                              <div className="overflow-x-auto">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-semibold text-gray-700">Sales for {member.name}</h3>
                                  <p className="text-xs text-gray-500">Enter sales for each member here. Salary and incentives are managed from the Salary screen.</p>
                                </div>
                                <table className="w-full">
                                  <thead className="bg-white">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sale Amount (₹)</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pack Type</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remove</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(data.salesEntries || []).map(entry => (
                                      <tr key={entry.id} className="border-t border-gray-200">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={entry.amount}
                                            onChange={(e) => updateSaleEntry(member.id, entry.id, 'amount', e.target.value)}
                                            className="w-24 rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                                          />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <select
                                            value={entry.packType}
                                            onChange={(e) => updateSaleEntry(member.id, entry.id, 'packType', e.target.value)}
                                            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                                          >
                                          <option value="Origin">Origin</option>
                                          <option value="Prime">Prime</option>
                                          <option value="Elite">Elite</option>
                                          <option value="Alfrah Ultra">Alfrah Ultra</option>
                                          <option value="Internship">Internship</option>
                                          <option value="Demo">Demo</option>
                                          </select>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <button
                                            onClick={() => removeSaleEntry(member.id, entry.id)}
                                            className="text-red-600 hover:text-red-800"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {(data.salesEntries || []).length === 0 && (
                                      <tr>
                                        <td colSpan={3} className="px-4 py-6 text-sm text-gray-500 text-center">
                                          No sales added yet. Click Add Sale to create a sale entry.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Download Report</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-500 hover:text-gray-900"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200">Start Date</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">End Date</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              {reportError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reportError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadReport}
                  disabled={reportLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {reportLoading ? 'Generating...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}