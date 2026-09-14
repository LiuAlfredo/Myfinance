import { create } from "zustand";

interface UiState {
  isSidebarCollapsed: boolean;
  isNewTransactionOpen: boolean;
  isCommandPaletteOpen: boolean;
  toastMessage: string | null;
  toggleSidebar: () => void;
  setNewTransactionOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  isNewTransactionOpen: false,
  isCommandPaletteOpen: false,
  toastMessage: null,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setNewTransactionOpen: (open) => set({ isNewTransactionOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  showToast: (message) => set({ toastMessage: message }),
  clearToast: () => set({ toastMessage: null }),
}));
