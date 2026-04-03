import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SportCard } from "../components/SportCard";
import { VIEW_COLORS } from "../constants";
import { useSports } from "../hooks/useQueries";
import type { PrimaryView } from "../types";

export function SportsPage() {
  const { data: sports = [] } = useSports();
  const [activeView, setActiveView] = useState<PrimaryView | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => sports.filter((s) => {
    const matchView = activeView === "ALL" || s.primaryView === activeView;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return matchView && matchSearch;
  }), [sports, activeView, search]);

  const views: Array<PrimaryView | "ALL"> = ["ALL", "BRACKET", "HYBRID", "STANDINGS", "LEADERBOARD"];

  return (
    <motion.div className="page-sports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="page-title">Sports Catalog</h1>
      <p className="page-sub">{sports.length} sports across all competition formats.</p>
      <div className="sports-controls">
        <div className="pill-row">
          {views.map((view) => (
            <button key={view} className={`pill-btn ${activeView === view ? "active" : ""}`}
              style={activeView === view && view !== "ALL" ? { "--pill-color": VIEW_COLORS[view] } as any : {}}
              onClick={() => setActiveView(view)}>{view === "ALL" ? "All Sports" : view}</button>
          ))}
        </div>
        <input className="field-input search-input" placeholder="Search sports..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="sport-grid-v2">
        <AnimatePresence>{filtered.map((s, i) => <SportCard key={s.id} sport={s} index={i} />)}</AnimatePresence>
      </div>
    </motion.div>
  );
}
