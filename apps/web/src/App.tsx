import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Nav } from "./components/Nav";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { refreshSession } from "./api";
import { CreatePage } from "./pages/CreatePage";
import { HomePage } from "./pages/HomePage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { SportsPage } from "./pages/SportsPage";
import { TournamentPage } from "./pages/TournamentPage";
import { useAppStore } from "./store";
import { useSports, useTournaments } from "./hooks/useQueries";

// Pages that require the user to be logged in
const PROTECTED_PAGES = new Set(["create", "tournament", "admin"]);

export function App() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const user = useAppStore((s) => s.user);

  // Redirect to login if trying to access a protected page without auth
  useEffect(() => {
    if (PROTECTED_PAGES.has(page) && !user) {
      setPage("login");
    }
  }, [page, user, setPage]);

  // On load, re-read the account from the server so a role change made by an admin (or an
  // expired token) is picked up. A 401 here signs the user out via the shared error handling.
  const hasToken = useAppStore((s) => !!s.token);
  useEffect(() => {
    if (!hasToken) return;
    refreshSession()
      .then((r) => useAppStore.getState().login(r.token, r.user))
      .catch(() => { /* offline or server error: keep the current session */ });
  }, [hasToken]);

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
          {page === "login"      && <AuthPage key="login" mode="login" />}
          {page === "register"   && <AuthPage key="register" mode="register" />}
          {page === "home"       && <HomePage key="home" />}
          {page === "create"     && <CreatePage key="create" />}
          {page === "tournament" && <TournamentPage key="tournament" />}
          {page === "sports"     && <SportsPage key="sports" />}
          {page === "playground" && <PlaygroundPage key="playground" />}
          {page === "admin"      && <AdminPage key="admin" />}
        </AnimatePresence>
      </main>
      <footer className="app-footer">
        <p>Zemo Tournament OS · Built with Arena Pulse Design System</p>
      </footer>
    </div>
  );
}
