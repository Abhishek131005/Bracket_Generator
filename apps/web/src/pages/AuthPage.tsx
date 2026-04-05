import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { loginAccount, registerAccount } from "../api";
import { useAppStore } from "../store";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const login = useAppStore((s) => s.login);
  const setPage = useAppStore((s) => s.setPage);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ORGANIZER" | "REFEREE" | "VIEWER">("ORGANIZER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = mode === "login"
        ? await loginAccount({ email, password })
        : await registerAccount({ email, password, name, role });
      login(result.token, result.user);
      setPage("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">ZEMO</span>
          <h1 className="auth-title">{mode === "login" ? "Welcome back" : "Create account"}</h1>
          <p className="auth-subtitle">
            {mode === "login" ? "Sign in to manage your tournaments." : "Set up your Zemo account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <AnimatePresence>
              <motion.div
                className="auth-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <label className="auth-label">Name</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </motion.div>
            </AnimatePresence>
          )}

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="field-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === "login"}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="field-input"
              type="password"
              placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
            />
          </div>

          {mode === "register" && (
            <div className="auth-field">
              <label className="auth-label">Role</label>
              <select
                className="field-select"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="ORGANIZER">Organizer — manage tournaments &amp; stages</option>
                <option value="REFEREE">Referee — enter scores &amp; results</option>
                <option value="VIEWER">Viewer — read only</option>
              </select>
              <p className="auth-hint">Admins are created directly in the database.</p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-lime btn-full auth-submit" disabled={loading}>
            {loading ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? (
            <>No account? <button className="auth-switch-btn" onClick={() => setPage("register")}>Register</button></>
          ) : (
            <>Already have an account? <button className="auth-switch-btn" onClick={() => setPage("login")}>Sign in</button></>
          )}
        </p>
      </div>
    </motion.div>
  );
}
