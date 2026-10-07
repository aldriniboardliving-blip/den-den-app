// src/store/ui.ts
// UI store for toasts, modals, loading states

import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface Modal {
  id: string;
  component: React.ReactNode;
  props?: Record<string, unknown>;
}

interface UIState {
  toasts: Toast[];
  modals: Modal[];
  loading: Record<string, boolean>;

  // Toast actions
  showToast: (toast: Omit<Toast, 'id'>) => string;
  hideToast: (id: string) => void;

  // Modal actions
  showModal: (modal: Omit<Modal, 'id'>) => string;
  hideModal: (id: string) => void;

  // Loading actions
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  modals: [],
  loading: {},

  showToast: toast => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    set(state => ({ toasts: [...state.toasts, newToast] }));

    // Auto-hide
    setTimeout(() => {
      get().hideToast(id);
    }, toast.duration || 5000);

    return id;
  },

  hideToast: id =>
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    })),

  showModal: modal => {
    const id = `modal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newModal: Modal = { ...modal, id };

    set(state => ({ modals: [...state.modals, newModal] }));
    return id;
  },

  hideModal: id =>
    set(state => ({
      modals: state.modals.filter(m => m.id !== id),
    })),

  setLoading: (key, loading) =>
    set(state => ({
      loading: { ...state.loading, [key]: loading },
    })),

  isLoading: key => get().loading[key] ?? false,
}));
