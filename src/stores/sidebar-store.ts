import { create } from "zustand";

const STORAGE_KEY = "laundryku-sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Abaikan kegagalan penyimpanan preferensi.
  }
}

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: readCollapsed(),
  toggle: () => {
    const next = !get().collapsed;
    persistCollapsed(next);
    set({ collapsed: next });
  },
  setCollapsed: (collapsed) => {
    persistCollapsed(collapsed);
    set({ collapsed });
  },
}));
