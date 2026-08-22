import { create } from 'zustand';

export type UserRole = 'ADMIN' | 'INCIDENT_MANAGER' | 'GUEST';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'p1' | 'update' | 'bridge' | 'recovery' | 'closed';
  time: string;
}

interface CimState {
  currentRole: UserRole;
  userEmail: string;
  userName: string;
  searchQuery: string;
  priorityFilter: string;
  statusFilter: string;
  groupFilter: string;
  serviceFilter: string;
  countryFilter: string;
  isFetchModalOpen: boolean;
  isCopilotOpen: boolean;
  toasts: ToastNotification[];
  refreshTrigger: number;

  setUser: (user: { id: string; name: string; email: string; role: UserRole }) => void;
  setRole: (role: UserRole) => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (p: string) => void;
  setStatusFilter: (s: string) => void;
  setGroupFilter: (g: string) => void;
  setServiceFilter: (s: string) => void;
  setCountryFilter: (c: string) => void;
  setFetchModalOpen: (open: boolean) => void;
  setCopilotOpen: (open: boolean) => void;
  addToast: (toast: Omit<ToastNotification, 'id' | 'time'>) => void;
  removeToast: (id: string) => void;
  triggerRefresh: () => void;
}

export const useCimStore = create<CimState>((set, get) => ({
  currentRole: 'GUEST',
  userEmail: '',
  userName: '',
  searchQuery: '',
  priorityFilter: 'ALL',
  statusFilter: 'ALL',
  groupFilter: 'ALL',
  serviceFilter: 'ALL',
  countryFilter: 'ALL',
  isFetchModalOpen: false,
  isCopilotOpen: false,
  toasts: [
    {
      id: 'init-1',
      title: '🚨 New P1 Incident Active',
      message: 'INC0012456 - PostgreSQL Database Saturation is impacting 12 sites.',
      type: 'p1',
      time: 'Just now',
    },
    {
      id: 'init-2',
      title: '🎧 Teams Bridge Live',
      message: 'Command Bridge for INC0012456 is active with 8 participants.',
      type: 'bridge',
      time: '2m ago',
    },
  ],
  refreshTrigger: 0,

  setUser: (user) => {
    set({
      currentRole: user.role,
      userName: user.name,
      userEmail: user.email,
    });
  },

  setRole: (role: UserRole) => {
    const currentName = get().userName;
    const currentEmail = get().userEmail;
    set({ currentRole: role, userName: currentName, userEmail: currentEmail });
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setPriorityFilter: (p: string) => set({ priorityFilter: p }),
  setStatusFilter: (s: string) => set({ statusFilter: s }),
  setGroupFilter: (g: string) => set({ groupFilter: g }),
  setServiceFilter: (s: string) => set({ serviceFilter: s }),
  setCountryFilter: (c: string) => set({ countryFilter: c }),
  setFetchModalOpen: (open: boolean) => set({ isFetchModalOpen: open }),
  setCopilotOpen: (open: boolean) => set({ isCopilotOpen: open }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set((state) => ({
      toasts: [{ ...toast, id, time }, ...state.toasts.slice(0, 4)],
    }));
  },

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
