import { create } from 'zustand';
import { authService } from '@/services/authService';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => Promise<void>;
  initializeAuth: () => void;
}

const getInitialToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('biofactor_auth_token');
  }
  return null;
};

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = getInitialToken();
  
  return {
    isAuthenticated: !!initialToken,
    isLoading: false,
    token: initialToken,

    login: (token: string) => {
      localStorage.setItem('biofactor_auth_token', token);
      set({ isAuthenticated: true, token });
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await authService.logoutAdmin();
        set({ isAuthenticated: false, token: null });
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    initializeAuth: () => {
      const token = localStorage.getItem('biofactor_auth_token');
      if (token) {
        set({ isAuthenticated: true, token });
      } else {
        set({ isAuthenticated: false, token: null });
      }
    }
  };
});
