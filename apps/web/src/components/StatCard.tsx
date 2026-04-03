import { motion } from "framer-motion";

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <motion.div className="stat-card" style={{ "--accent": accent } as any}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </motion.div>
  );
}
