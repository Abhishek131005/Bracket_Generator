import { AnimatePresence, motion } from "framer-motion";
import { Nav } from "./components/Nav";
import { CreatePage } from "./pages/CreatePage";
import { HomePage } from "./pages/HomePage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { SportsPage } from "./pages/SportsPage";
import { TournamentPage } from "./pages/TournamentPage";
import { useAppStore } from "./store";
import { useSports, useTournaments } from "./hooks/useQueries";

export function App() {
  const page = useAppStore((s) => s.page);

  const { error: sportsError } = useSports();
  const { error: tournamentsError } = useTournaments();

  const apiError = sportsError
    ? "Could not reach API. Make sure the backend is running on port 4000."
    : tournamentsError
    ? (() => {
        const msg = tournamentsError instanceof Error ? tournamentsError.message : "";
        return msg.toLowerCase().includes("database") || msg.toLowerCase().includes("environ")
          ? "Database not connected. Create apps/api/.env with a valid DATABASE_URL and restart the API."
          : "Could not load tournaments. Check the API logs for details.";
      })()
    : "";

  return (
    <div className="app-root">
      <Nav />
      <main className="app-main">
        {apiError && (
          <motion.div className="api-error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ⚠️ {apiError}
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {page === "home"       && <HomePage key="home" />}
          {page === "create"     && <CreatePage key="create" />}
          {page === "tournament" && <TournamentPage key="tournament" />}
          {page === "sports"     && <SportsPage key="sports" />}
          {page === "playground" && <PlaygroundPage key="playground" />}
        </AnimatePresence>
      </main>
      <footer className="app-footer">
        <p>Zemo Tournament OS · Built with Arena Pulse Design System</p>
      </footer>
    </div>
  );
}
