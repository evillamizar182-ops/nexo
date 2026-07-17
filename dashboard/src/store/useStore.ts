import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AppState {
  isAuthenticated: boolean;
  authLoading: boolean;
  user: User | null;
  activeTab: 'dashboard' | 'finanzas' | 'chats' | 'asistente' | 'templates' | 'inventory' | 'settings' | 'profile' | 'business';
  selectedPhone: string | null;
  setAuthenticated: (status: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  setUser: (user: User | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setSelectedPhone: (phone: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // El JWT vive en una cookie httpOnly (no legible por JS). La sesión se valida
  // contra /auth/me al cargar; hasta entonces, authLoading evita el flash del login.
  isAuthenticated: false,
  authLoading: true,
  user: null,
  activeTab: 'dashboard',
  selectedPhone: null,
  setAuthenticated: (status) => set({ isAuthenticated: status }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setUser: (user) => set({ user }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedPhone: (phone) => set({ selectedPhone: phone }),
}));
