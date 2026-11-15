import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "laundryku-theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // localStorage bisa diblokir; pakai preferensi sistem.
  }
  return "system";
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  resolved: resolveTheme(readStoredTheme()),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Abaikan kegagalan penyimpanan preferensi.
    }
    const resolved = applyTheme(theme);
    set({ theme, resolved });
  },
  toggleTheme: () => {
    const next: Theme = get().resolved === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

/** Dipanggil sekali saat aplikasi mulai; juga mengikuti perubahan tema sistem. */
export function initTheme(): void {
  const state = useThemeStore.getState();
  applyTheme(state.theme);

  if (typeof window === "undefined") return;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (): void => {
    if (useThemeStore.getState().theme !== "system") return;
    const resolved = applyTheme("system");
    useThemeStore.setState({ resolved });
  };

  media.addEventListener("change", handleChange);
}
