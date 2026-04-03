import { motion } from "framer-motion";
import { useMemo } from "react";
import { FORMAT_LABELS, VIEW_COLORS } from "../constants";
import { SportCard } from "../components/SportCard";
import { StatCard } from "../components/StatCard";
import type { Page } from "../appTypes";
import type { SportDefinition, Tournament } from "../types";

export function HomePage({ sports, tournaments, setPage }: {
  sports: SportDefinition[];
  tournaments: Tournament[];
  setPage: (p: Page) => void;
}) {
  const viewStats = useMemo(() => {
    const s = { BRACKET: 0, HYBRID: 0, STANDINGS: 0, LEADERBOARD: 0 };
    for (const sport of sports) s[sport.primaryView as keyof typeof s] += 1;
    return s;
  }, [sports]);

  return (
    <motion.div className="page-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="home-hero">
        <div className="home-hero-bg">
          <div className="hero-orb hero-orb-1" /><div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" /><div className="hero-grid-lines" />
        </div>
        <div className="home-hero-content">
          <motion.p className="hero-eyebrow" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            ⚡ Zemo Tournament Command Center
          </motion.p>
          <motion.h1 className="hero-headline" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
            Build Brackets.<br /><span className="hero-hl">Run Leagues.</span><br />Dominate Leaderboards.
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            One platform for all {sports.length} sports — format-aware orchestration with a stunning live experience.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <button className="btn-primary" onClick={() => setPage("create")}>Start a Tournament</button>
            <button className="btn-ghost" onClick={() => setPage("playground")}>Try Bracket Lab →</button>
          </motion.div>
        </div>
      </div>
      <div className="stats-row">
        <StatCard label="Total Sports" value={sports.length} accent="#c7f464" />
        <StatCard label="Bracket Sports" value={viewStats.BRACKET + viewStats.HYBRID} accent="#ff6b35" />
        <StatCard label="Leaderboard Sports" value={viewStats.LEADERBOARD} accent="#f4d35e" />
        <StatCard label="Total Tournaments" value={tournaments.length} accent="#2ec4b6" />
      </div>
      {tournaments.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">Recent Tournaments</h2>
            <button className="link-btn" onClick={() => setPage("tournament")}>View All →</button>
          </div>
          <div className="tournament-grid">
            {tournaments.slice(0, 6).map((t, i) => (
              <motion.article key={t.id} className="tournament-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }} onClick={() => setPage("tournament")}>
                <div className="tc-top">
                  <span className={`tc-status status-${t.status.toLowerCase()}`}>{t.status}</span>
                  <span className="tc-sport">{t.sportName}</span>
                </div>
                <h3 className="tc-name">{t.name}</h3>
                <p className="tc-format">{FORMAT_LABELS[t.format] ?? t.format}</p>
                <p className="tc-date">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </motion.article>
            ))}
          </div>
        </section>
      )}
      <section className="home-section">
        <div className="section-header">
          <h2 className="section-title">Sports Catalog Preview</h2>
          <button className="link-btn" onClick={() => setPage("sports")}>Browse All {sports.length} →</button>
        </div>
        <div className="sport-preview-row">
          {sports.slice(0, 6).map((s, i) => <SportCard key={s.id} sport={s} index={i} />)}
        </div>
      </section>
    </motion.div>
  );
}
