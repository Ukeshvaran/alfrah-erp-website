import { useState, useEffect } from 'react';
import { AuthProvider, useAuth, type TeamLead } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { TeamDashboard } from './components/TeamDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SalaryDashboard } from './components/SalaryDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { Home, BarChart3, Wallet, LogOut, LayoutDashboard } from 'lucide-react';

type Page = 'login' | 'dashboard' | 'salary' | 'analytics' | 'admin';

function AppContent() {
  const { teamLead, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('login');

  useEffect(() => {
    if (teamLead) {
      setCurrentPage(teamLead.is_admin ? 'admin' : 'dashboard');
    } else {
      setCurrentPage('login');
    }
  }, [teamLead]);

  const handleLoginSuccess = (user: TeamLead) => {
    setCurrentPage(user.is_admin ? 'admin' : 'dashboard');
  };

  const handleNavigateToAnalytics = () => {
    setCurrentPage('analytics');
  };
  const handleNavigateToSalary = () => {
    setCurrentPage('salary');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  if (currentPage === 'login') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (teamLead?.is_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 text-slate-100">
        <div className="flex min-h-screen">
          <aside className="w-72 border-r border-white/10 bg-slate-950/80 p-6 backdrop-blur-xl">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">ALFRAH ERP</h2>
              <p className="mt-1 text-sm text-slate-400">Admin</p>
              {teamLead.team_name ? (
                <p className="mt-1 text-sm text-cyan-300/90">Team: {teamLead.team_name}</p>
              ) : null}
            </div>
            <nav className="space-y-3">
              <button
                type="button"
                onClick={() => setCurrentPage('admin')}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  currentPage === 'admin'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard size={18} />
                Admin dashboard
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-500 hover:text-white"
              >
                <LogOut size={18} />
                Logout
              </button>
            </nav>
          </aside>
          <main className="flex-1">
            <AdminDashboard />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-900 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-white/10 bg-slate-950/80 p-6 backdrop-blur-xl">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white">ALFRAH ERP</h2>
            <p className="mt-1 text-sm text-slate-400">Welcome, {teamLead?.name}</p>
            {teamLead?.team_name ? (
              <p className="mt-1 text-sm text-slate-500">Team: {teamLead.team_name}</p>
            ) : null}
          </div>

          <nav className="space-y-3">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                currentPage === 'dashboard'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Home size={18} />
              Home
            </button>
            <button
              type="button"
              onClick={handleNavigateToSalary}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                currentPage === 'salary'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Wallet size={18} />
              Salary & Incentive
            </button>
            <button
              type="button"
              onClick={handleNavigateToAnalytics}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                currentPage === 'analytics'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BarChart3 size={18} />
              View Overall Dashboard
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-500 hover:text-white"
            >
              <LogOut size={18} />
              Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1">
          {currentPage === 'analytics' ? (
            <AnalyticsDashboard onBack={handleBackToDashboard} />
          ) : currentPage === 'salary' ? (
            <SalaryDashboard />
          ) : (
            <TeamDashboard />
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
