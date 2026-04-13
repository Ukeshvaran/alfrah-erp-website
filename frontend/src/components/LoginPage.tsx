import { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { useAuth, type TeamLead } from '../contexts/AuthContext';

interface LoginPageProps {
  onLoginSuccess: (user: TeamLead) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [teamLeadName, setTeamLeadName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const companyLogoUrl = `${import.meta.env.BASE_URL}company-logo.jpeg`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!teamLeadName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);

    try {
      const user = await login(teamLeadName.trim(), accessCode);
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Background logo */}
      <div
        className="absolute inset-0 opacity-5 bg-center bg-no-repeat bg-contain"
        style={{
          backgroundImage: `url(${companyLogoUrl})`,
          backgroundSize: '400px 400px'
        }}
      />
      <div className="w-full max-w-2xl rounded-[32px] bg-slate-900/95 border border-white/10 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl p-10 relative z-10">
        <div className="flex flex-col items-center gap-8">
          <img
            src={companyLogoUrl}
            alt="ALFRAH COGNIX LOGO"
            className="w-25 h-24 object-cover rounded-full"
          />
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Company</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">ALFRAH COGNIX INNOVATION PVT LTD</h1>
          </div>

          <div className="w-full rounded-[28px] bg-slate-950/90 border border-white/10 p-8 shadow-lg shadow-slate-950/30">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="teamLeadName" className="block text-sm font-medium text-slate-400 mb-2">
                  Your Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="teamLeadName"
                    type="text"
                    value={teamLeadName}
                    onChange={(e) => setTeamLeadName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 pl-11 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                    placeholder="Enter your name"
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="accessCode" className="block text-sm font-medium text-slate-400 mb-2">
                  Access Code
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="accessCode"
                    type="password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 pl-11 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                    placeholder="Enter your access code"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 bg-opacity-10">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}