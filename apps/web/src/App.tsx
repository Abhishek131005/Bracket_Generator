import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchSports, fetchTournaments } from "./api";
import { Nav } from "./components/Nav";
import { CreatePage } from "./pages/CreatePage";
import { HomePage } from "./pages/HomePage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { SportsPage } from "./pages/SportsPage";
import { TournamentPage } from "./pages/TournamentPage";
import type { SportDefinition, Tournament } from "./types";
import type { Page } from "./appTypes";

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [sports, setSports] = useState<SportDefinition[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Sports are in-memory — always load them first independently
    fetchSports()
      .then((s) => { if (!cancelled) setSports(s); })
      .catch(() => { if (!cancelled) setError("Could not reach API. Make sure the backend is running on port 4000."); });

    // Tournaments require a live database — fail gracefully
    fetchTournaments()
      .then((t) => { if (!cancelled) { setTournaments(t); setError(""); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("database") || msg.toLowerCase().includes("prisma") || msg.toLowerCase().includes("environ")) {
          setError("Database not connected. Create apps/api/.env with a valid DATABASE_URL and restart the API.");
        } else {
          setError("Could not load tournaments. Check the API logs for details.");
        }
      });

    return () => { cancelled = true; };
  }, []);

  function handleTournamentCreated(t: Tournament) {
    setTournaments((prev) => [t, ...prev]);
    setPage("tournament");
  }

  return (
    <div className="app-root">
      <Nav page={page} setPage={setPage} />
      <main className="app-main">
        {error && <motion.div className="api-error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>⚠️ {error}</motion.div>}
        <AnimatePresence mode="wait">
          {page === "home" && <HomePage key="home" sports={sports} tournaments={tournaments} setPage={setPage} />}
          {page === "create" && <CreatePage key="create" sports={sports} onCreated={handleTournamentCreated} />}
          {page === "tournament" && <TournamentPage key="tournament" tournaments={tournaments} sports={sports} />}
          {page === "sports" && <SportsPage key="sports" sports={sports} />}
          {page === "playground" && <PlaygroundPage key="playground" />}
        </AnimatePresence>
      </main>
      <footer className="app-footer">
        <p>Zemo Tournament OS · {sports.length} Sports · Built with Arena Pulse Design System</p>
      </footer>
    </div>
  );
}
