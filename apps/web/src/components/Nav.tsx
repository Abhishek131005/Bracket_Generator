import { motion } from "framer-motion";
import type { Page } from "../appTypes";

export function Nav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
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
            <button className={`nav-link ${page === link.id ? "active" : ""}`} onClick={() => setPage(link.id)}>
              {link.label}
              {page === link.id && <motion.span className="nav-active-dot" layoutId="nav-dot" />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
