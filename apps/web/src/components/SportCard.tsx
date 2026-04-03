import { motion } from "framer-motion";
import { FORMAT_LABELS, VIEW_COLORS } from "../constants";
import type { SportDefinition } from "../types";

export function SportCard({ sport, index }: { sport: SportDefinition; index: number }) {
  const color = VIEW_COLORS[sport.primaryView] ?? "#fff";
  return (
    <motion.article className="sport-card-v2" style={{ "--sport-accent": color } as any}
      initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }} transition={{ duration: 0.22, delay: index * 0.012 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}>
      <div className="sc-header">
        <span className="sc-id">#{sport.id}</span>
        <span className="sc-tag" style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>{sport.primaryView}</span>
      </div>
      <h3 className="sc-name">{sport.name}</h3>
      <p className="sc-format">{FORMAT_LABELS[sport.format] ?? sport.format}</p>
      <p className="sc-rule">{sport.rankingRule.replace(/_/g, " ")}</p>
      {sport.notes && <p className="sc-note">{sport.notes}</p>}
      <div className="sc-glow" style={{ background: `radial-gradient(circle at 80% 20%, ${color}22, transparent 60%)` }} />
    </motion.article>
  );
}
