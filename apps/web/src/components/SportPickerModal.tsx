import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { FORMAT_LABELS, VIEW_COLORS, VIEW_ICONS } from "../constants";
import type { PrimaryView, SportDefinition } from "../types";

export function SportPickerModal({
  sports,
  selectedId,
  onSelect,
  onClose,
}: {
  sports: SportDefinition[];
  selectedId: number | "";
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PrimaryView | "ALL">("ALL");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const views: Array<PrimaryView | "ALL"> = ["ALL", "BRACKET", "HYBRID", "STANDINGS", "LEADERBOARD"];

  const filtered = useMemo(
    () =>
      sports.filter((s) => {
        const matchView = activeView === "ALL" || s.primaryView === activeView;
        const matchSearch =
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.format.toLowerCase().includes(search.toLowerCase());
        return matchView && matchSearch;
      }),
    [sports, activeView, search]
  );

  return (
    <motion.div
      className="sport-picker-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="sport-picker-modal"
        initial={{ opacity: 0, y: 48, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
      >
        <div className="spm-header">
          <div>
            <h2 className="spm-title">Choose a Sport</h2>
            <p className="spm-sub">{filtered.length} of {sports.length} sports shown</p>
          </div>
          <button className="spm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="spm-search-wrap">
          <span className="spm-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="spm-search"
            placeholder="Search sports or formats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="spm-search-clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
          )}
        </div>

        <div className="spm-filters">
          {views.map((v) => {
            const count = v === "ALL" ? sports.length : sports.filter((s) => s.primaryView === v).length;
            const color = v !== "ALL" ? VIEW_COLORS[v] : undefined;
            return (
              <button
                key={v}
                className={`spm-filter-pill ${activeView === v ? "active" : ""}`}
                style={activeView === v && color ? ({ "--pill-c": color } as any) : {}}
                onClick={() => setActiveView(v)}
              >
                {v !== "ALL" && <span className="spm-filter-icon">{VIEW_ICONS[v]}</span>}
                <span>{v === "ALL" ? "All" : v.charAt(0) + v.slice(1).toLowerCase()}</span>
                <span className="spm-filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="spm-grid-wrap">
          {filtered.length === 0 ? (
            <div className="spm-empty">
              <span>🤔</span>
              <p>No sports match "<strong>{search}</strong>"</p>
            </div>
          ) : (
            <div className="spm-grid">
              {filtered.map((sport, i) => {
                const color = VIEW_COLORS[sport.primaryView] ?? "#fff";
                const isSelected = selectedId === sport.id;
                return (
                  <motion.button
                    key={sport.id}
                    className={`spm-card ${isSelected ? "selected" : ""}`}
                    style={{ "--sc": color } as any}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.007, duration: 0.16 }}
                    onClick={() => { onSelect(sport.id); onClose(); }}
                    whileHover={{ y: -3, transition: { duration: 0.12 } }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {isSelected && (
                      <motion.span
                        className="spm-card-check"
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 420 }}
                      >
                        ✓
                      </motion.span>
                    )}
                    <div className="spm-card-glow" />
                    <span className="spm-card-id">#{sport.id}</span>
                    <h3 className="spm-card-name">{sport.name}</h3>
                    <div className="spm-card-footer">
                      <span
                        className="spm-card-tag"
                        style={{ color, background: `${color}18`, border: `1px solid ${color}38` }}
                      >
                        {sport.primaryView}
                      </span>
                      <span className="spm-card-format">{FORMAT_LABELS[sport.format] ?? sport.format}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
