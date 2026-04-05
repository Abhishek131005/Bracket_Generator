import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Page } from "./appTypes";

export type UserRole = "ADMIN" | "ORGANIZER" | "REFEREE" | "VIEWER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AppStore {
  // ── Navigation ──────────────────────────────────────────────────────────────
  page: Page;
  setPage: (page: Page) => void;

  // ── Tournament selection ─────────────────────────────────────────────────────
  selectedTournamentId: string;
  setSelectedTournamentId: (id: string) => void;

  // ── Stage selection ──────────────────────────────────────────────────────────
  selectedStageId: string | null;
  setSelectedStageId: (id: string | null) => void;

  // ── Auth ─────────────────────────────────────────────────────────────────────
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      page: "home",
      setPage: (page) => set({ page }),

      selectedTournamentId: "",
      setSelectedTournamentId: (id) => set({ selectedTournamentId: id, selectedStageId: null }),

      selectedStageId: null,
      setSelectedStageId: (id) => set({ selectedStageId: id }),

      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null, page: "login" }),
    }),
    {
      name: "zemo-auth",
      // Only persist auth — navigation and selection are ephemeral
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
