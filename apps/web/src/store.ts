import { create } from "zustand";
import type { Page } from "./appTypes";

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
}

export const useAppStore = create<AppStore>((set) => ({
  page: "home",
  setPage: (page) => set({ page }),

  selectedTournamentId: "",
  setSelectedTournamentId: (id) => set({ selectedTournamentId: id, selectedStageId: null }),

  selectedStageId: null,
  setSelectedStageId: (id) => set({ selectedStageId: id }),
}));
