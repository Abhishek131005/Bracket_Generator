import { motion } from "framer-motion";
import type { Page } from "../appTypes";
import { useAppStore } from "../store";

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "Admin",
  ORGANIZER: "Organizer",
  REFEREE: "Referee",
  VIEWER: "Viewer",
};

export function Nav() {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  const links: { id: Page; label: string }[] = [
    { id: "home", label: "Dashboard" },
    { id: "create", label: "New Tournament" },
    { id: "tournament", label: "Tournament Hub" },
    { id: "sports", label: "Sports Catalog" },
    { id: "playground", label: "Bracket Lab" },
  ];

  return (
    <nav className="main-nav">
      <div className="nav-logo">
        <span className="nav-logo-text">ZEMO</span>
        <span className="nav-logo-sub">Tournament OS</span>
      </div>
      <ul className="nav-links">
        {links.map((link) => (
          <li key={link.id}>
            <button
              className={`nav-link ${page === link.id ? "active" : ""}`}
              onClick={() => setPage(link.id)}
            >
              {link.label}
              {page === link.id && (
                <motion.span className="nav-active-dot" layoutId="nav-dot" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav-auth">
        {user ? (
          <>
            <span className="nav-user-name">{user.name}</span>
            <span className={`nav-role-badge role-${user.role.toLowerCase()}`}>
              {ROLE_BADGE[user.role] ?? user.role}
            </span>
            <button className="nav-logout-btn" onClick={logout}>Sign out</button>
          </>
        ) : (
          <button className="btn-lime nav-login-btn" onClick={() => setPage("login")}>
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
