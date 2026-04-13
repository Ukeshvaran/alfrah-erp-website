import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axios from 'axios';

axios.defaults.baseURL = '/';

export interface TeamLead {
  id: number;
  name: string;
  team_name: string;
  is_admin: boolean;
}

interface AuthContextType {
  teamLead: TeamLead | null;
  login: (name: string, accessCode: string) => Promise<TeamLead>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teamLead, setTeamLead] = useState<TeamLead | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('teamLead');
    if (savedUser) {
      const user = JSON.parse(savedUser) as TeamLead;
      setTeamLead({
        ...user,
        team_name: user.team_name ?? '',
        is_admin: Boolean(user.is_admin),
      });
    }
  }, []);

  const login = async (name: string, accessCode: string): Promise<TeamLead> => {
    const response = await axios.post('/api/auth/login', {
      name,
      access_code: accessCode,
    });

    const user: TeamLead = {
      ...response.data,
      team_name: response.data.team_name ?? '',
      is_admin: Boolean(response.data.is_admin),
    };
    setTeamLead(user);
    localStorage.setItem('teamLead', JSON.stringify(user));
    localStorage.setItem('username', user.name);
    return user;
  };

  const logout = () => {
    setTeamLead(null);
    localStorage.removeItem('teamLead');
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider value={{ teamLead, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}